using CRMSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Quartz;

namespace CRMSystem.Application.Jobs;

/// <summary>
/// Queues one client email reminder shortly before a confirmed meeting starts.
/// The notification ActionUrl includes the meeting id and is also used as the
/// idempotency key, so a one-minute Quartz schedule never sends duplicates.
/// </summary>
[DisallowConcurrentExecution]
public sealed class MeetingReminderJob(PortalDbContext db) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var now = DateTimeOffset.UtcNow;
        var reminderCutoff = now.AddMinutes(15);
        // Also catch meetings confirmed for "right now" or that started moments ago —
        // strictly requiring StartsAt to still be in the future missed exactly those
        // cases (a meeting scheduled for immediately, or one this job's own one-minute
        // tick landed just after). A short look-back window still avoids ever reminding
        // about a meeting from days ago.
        var lookBackFloor = now.AddMinutes(-15);

        var meetings = await db.Meetings.IgnoreQueryFilters()
            .Where(x =>
                x.Status == "Confirmed"
                && x.StartsAt != null
                && x.StartsAt >= lookBackFloor
                && x.StartsAt <= reminderCutoff)
            .OrderBy(x => x.StartsAt)
            .Take(100)
            .ToListAsync(ct);

        var requesterLanguages = await db.Users
            .Where(u => meetings.Select(m => m.RequestedByUserId).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.PreferredLanguage, ct);

        foreach (var meeting in meetings)
        {
            var actionUrl = $"/portal?tab=meetings&meetingId={meeting.Id}";
            var alreadyQueued = await db.Notifications.IgnoreQueryFilters().AnyAsync(x =>
                x.RecipientUserId == meeting.RequestedByUserId
                && x.Type == "MeetingReminder15Minutes"
                && x.ActionUrl == actionUrl,
                ct);
            if (alreadyQueued)
                continue;

            var startsAtLocal = meeting.StartsAt!.Value.ToSkopje();
            var requesterLanguage = requesterLanguages.GetValueOrDefault(meeting.RequestedByUserId);
            var (reminderSubject, reminderBody) = requesterLanguage switch
            {
                "en" => ("Meeting reminder", $"<p>You have <strong>{System.Net.WebUtility.HtmlEncode(meeting.Subject)}</strong> scheduled at {startsAtLocal:HH:mm}.</p>"),
                "sq" => ("Kujtues për takimin", $"<p>Keni <strong>{System.Net.WebUtility.HtmlEncode(meeting.Subject)}</strong> të planifikuar në {startsAtLocal:HH:mm}.</p>"),
                _ => ("Потсетник за состанок", $"<p>Во {startsAtLocal:HH:mm} имате закажано <strong>{System.Net.WebUtility.HtmlEncode(meeting.Subject)}</strong>.</p>"),
            };
            db.Notifications.Add(new Notification
            {
                TenantId = meeting.TenantId,
                RecipientUserId = meeting.RequestedByUserId,
                Language = requesterLanguage,
                Type = "MeetingReminder15Minutes",
                Subject = reminderSubject,
                Body = reminderBody,
                ActionUrl = actionUrl,
            });
        }

        if (meetings.Count > 0)
            await db.SaveChangesAsync(ct);
    }
}
