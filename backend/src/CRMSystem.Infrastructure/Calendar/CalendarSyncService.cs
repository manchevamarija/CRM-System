using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;

namespace CRMSystem.Infrastructure.Calendar;

/// <summary>
/// Pushes confirmed CRM meetings into whichever calendar (Google or Microsoft) the
/// assigned staff member has connected. The client's email is added as an attendee, so
/// Google/Microsoft handle sending the actual invitation — the CRM never sends its own
/// calendar-invite email for this. The created event's id is stored back on the meeting so
/// the pull-sync job (CalendarPullSyncJob) never re-imports it as a "new" external event.
/// </summary>
public sealed class CalendarSyncService(
    PortalDbContext db,
    IHttpClientFactory httpClientFactory,
    CalendarTokenStore tokenStore,
    ILogger<CalendarSyncService> logger) : ICalendarSyncService
{
    public async Task PushMeetingAsync(Guid meetingId, CancellationToken ct)
    {
        var meeting = await db.Meetings.FindAsync([meetingId], ct);
        if (meeting is null || meeting.StartsAt is null || meeting.AssignedUserId is null)
            return;

        // A staff member can have both a Google and a Microsoft calendar connected at
        // once — push the meeting to every connection they have, not just whichever one
        // happens to come back first, so it shows up on all of their real calendars.
        var connections = await db.CalendarConnections
            .Where(x => x.UserId == meeting.AssignedUserId)
            .ToListAsync(ct);
        if (connections.Count == 0)
            return; // This staff member hasn't connected a calendar — nothing to do.

        var attendeeEmail = await db.Users
            .Where(x => x.Id == meeting.RequestedByUserId)
            .Select(x => x.Email)
            .FirstOrDefaultAsync(ct);

        foreach (var connection in connections)
        {
            try
            {
                var accessToken = await tokenStore.GetValidAccessTokenAsync(connection, ct);
                var externalEventId = connection.Provider == "Google"
                    ? await PushToGoogleAsync(accessToken, meeting, attendeeEmail, ct)
                    : await PushToMicrosoftAsync(accessToken, meeting, attendeeEmail, ct);

                // The Meeting entity only tracks one external event reference; with two
                // connections this ends up remembering whichever was pushed last. Both
                // calendars still get the real event either way — this field only affects
                // any future "update/cancel the pushed event" logic, not what the staff
                // member sees in their calendar apps.
                meeting.ExternalEventId = externalEventId;
                meeting.ExternalCalendarProvider = connection.Provider;
                connection.LastSyncedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                // A calendar push failure must never block confirming the meeting in the CRM
                // itself — the meeting stays confirmed either way, just without an external
                // calendar entry this time. Keep trying the other connection, if any.
                logger.LogWarning(ex, "Calendar push failed for meeting {MeetingId} on {Provider}", meetingId, connection.Provider);
            }
        }
    }

    public async Task DeleteExternalEventAsync(Guid meetingId, CancellationToken ct)
    {
        var meeting = await db.Meetings.FindAsync([meetingId], ct);
        if (meeting is null || meeting.AssignedUserId is null
            || string.IsNullOrEmpty(meeting.ExternalEventId)
            || string.IsNullOrEmpty(meeting.ExternalCalendarProvider))
            return; // Never pushed anywhere — nothing to remove.

        var connection = await db.CalendarConnections.FirstOrDefaultAsync(x =>
            x.UserId == meeting.AssignedUserId && x.Provider == meeting.ExternalCalendarProvider, ct);
        if (connection is null)
            return; // Calendar got disconnected since — nothing we can clean up remotely.

        try
        {
            var accessToken = await tokenStore.GetValidAccessTokenAsync(connection, ct);
            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var url = connection.Provider == "Google"
                ? $"https://www.googleapis.com/calendar/v3/calendars/primary/events/{meeting.ExternalEventId}"
                : $"https://graph.microsoft.com/v1.0/me/events/{meeting.ExternalEventId}";
            var response = await client.DeleteAsync(url, ct);
            // 404/410 just means it's already gone from the calendar (e.g. the person
            // deleted it there themselves) — that's fine, treat it the same as success.
            if (!response.IsSuccessStatusCode
                && response.StatusCode is not System.Net.HttpStatusCode.NotFound
                && response.StatusCode is not System.Net.HttpStatusCode.Gone)
                response.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Removing the calendar event failed for meeting {MeetingId} on {Provider}", meetingId, meeting.ExternalCalendarProvider);
            return; // Leave the reference in place so this can be retried/investigated later.
        }

        meeting.ExternalEventId = null;
        meeting.ExternalCalendarProvider = null;
        await db.SaveChangesAsync(ct);
    }

    private async Task<string> PushToGoogleAsync(string accessToken, Meeting meeting, string? attendeeEmail, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        // A meeting scheduled for "right now" can end up with EndsAt equal to (or even
        // before) StartsAt — not null, so the old null-coalescing fallback below never
        // kicked in, and Google/Microsoft correctly reject that as a 400 Bad Request.
        // Guard against any non-positive duration the same way as a missing EndsAt.
        var effectiveEnd = meeting.EndsAt is { } end && end > meeting.StartsAt!.Value
            ? end
            : meeting.StartsAt!.Value.AddHours(1);
        var body = new
        {
            summary = meeting.Subject,
            description = meeting.Description,
            location = meeting.MeetingType == "Online" ? meeting.OnlineLink : meeting.Location,
            start = new { dateTime = meeting.StartsAt!.Value.UtcDateTime.ToString("o"), timeZone = "UTC" },
            end = new { dateTime = effectiveEnd.UtcDateTime.ToString("o"), timeZone = "UTC" },
            attendees = string.IsNullOrWhiteSpace(attendeeEmail)
                ? Array.Empty<object>()
                : new object[] { new { email = attendeeEmail } },
        };
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await client.PostAsync(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
            content, ct);
        response.EnsureSuccessStatusCode();
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return json.RootElement.GetProperty("id").GetString()!;
    }

    private async Task<string> PushToMicrosoftAsync(string accessToken, Meeting meeting, string? attendeeEmail, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var effectiveEnd = meeting.EndsAt is { } end && end > meeting.StartsAt!.Value
            ? end
            : meeting.StartsAt!.Value.AddHours(1);
        var body = new
        {
            subject = meeting.Subject,
            body = new { contentType = "Text", content = meeting.Description },
            location = new { displayName = meeting.MeetingType == "Online" ? meeting.OnlineLink ?? "Online" : meeting.Location ?? "" },
            start = new { dateTime = meeting.StartsAt!.Value.UtcDateTime.ToString("o"), timeZone = "UTC" },
            end = new { dateTime = effectiveEnd.UtcDateTime.ToString("o"), timeZone = "UTC" },
            attendees = string.IsNullOrWhiteSpace(attendeeEmail)
                ? Array.Empty<object>()
                : new object[] { new { emailAddress = new { address = attendeeEmail }, type = "required" } },
        };
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("https://graph.microsoft.com/v1.0/me/events", content, ct);
        response.EnsureSuccessStatusCode();
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return json.RootElement.GetProperty("id").GetString()!;
    }
}
