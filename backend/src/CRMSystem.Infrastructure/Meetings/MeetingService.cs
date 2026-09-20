using System.Security.Claims;
using System.Text.Json;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Infrastructure.Persistence.Repositories;
using CRMSystem.Application;
using CRMSystem.Application.Realtime;

namespace CRMSystem.Infrastructure.Services;

public sealed class MeetingService(IMeetingRepository repository) : IMeetingService
{
    public async Task<IReadOnlyList<Meeting>> GetMineAsync(Guid userId, CancellationToken ct) =>
        await repository.ListRequestedByAsync(userId, ct);

    public async Task<IReadOnlyList<Meeting>> GetScheduledByMeAsync(Guid userId, CancellationToken ct) =>
        await repository.ListCreatedByAsync(userId, ct);

    public async Task<Meeting?> CreateAsync(MeetingRequest r, Guid actorUserId, Guid userId, CancellationToken ct)
    {
        var user = await repository.FindUserAsync(userId, ct);
        // Meeting requests are a support/contact feature.  A client who is already
        // linked to an organisation may request one even while their subscription is
        // being reviewed; subscription status must not turn the request into a 403.
        if (user is null)
            return null;
        if (r.TicketId is not null && !await repository.OwnsTicketAsync(userId, r.TicketId.Value, ct))
            return null;
        var item = new Meeting
        {
            // A client may request a meeting before the administrator has linked
            // their profile to an organisation. Guid.Empty is an explicit
            // "organisation pending" marker and is replaced by staff later.
            OrganizationId = user.OrganizationId ?? Guid.Empty,
            RequestedByUserId = userId,
            CreatedByUserId = actorUserId,
            TicketId = r.TicketId,
            Subject = r.Subject,
            Description = r.Description,
            MeetingType = r.MeetingType,
            StartsAt = r.PreferredStart,
            EndsAt = r.PreferredEnd,
            RequestedTimeWindow = r.RequestedTimeWindow,
            Location = r.Location,
            OnlineLink = r.OnlineLink,
            Notes = r.Notes,
        };
        var scheduledByAdmin = actorUserId != userId;
        var whenTextByLang = item.StartsAt is { } startsAt
            ? (mk: $" на ден {startsAt.ToSkopje():dd.MM.yyyy} во {startsAt.ToSkopje():HH:mm}",
               en: $" on {startsAt.ToSkopje():dd.MM.yyyy} at {startsAt.ToSkopje():HH:mm}",
               sq: $" më {startsAt.ToSkopje():dd.MM.yyyy} në {startsAt.ToSkopje():HH:mm}")
            : (mk: "", en: "", sq: "");
        var (meetingSubject, meetingBodyText) = user.PreferredLanguage switch
        {
            "en" => scheduledByAdmin
                ? ("The administrator scheduled a meeting with you", $"<p>The administrator requested <strong>{item.Subject}</strong> with you{whenTextByLang.en}.</p>")
                : ("Your meeting request has been received", $"<p>Meeting <strong>{item.Subject}</strong> has been scheduled{whenTextByLang.en}. You'll be notified once it's confirmed.</p>"),
            "sq" => scheduledByAdmin
                ? ("Administratori planifikoi një takim me ju", $"<p>Administratori kërkoi <strong>{item.Subject}</strong> me ju{whenTextByLang.sq}.</p>")
                : ("Kërkesa juaj për takim u pranua", $"<p>Takimi <strong>{item.Subject}</strong> u planifikua{whenTextByLang.sq}. Do të njoftoheni pasi të konfirmohet.</p>"),
            _ => scheduledByAdmin
                ? ("Администраторот побара состанок со вас", $"<p>Администраторот побара <strong>{item.Subject}</strong> со вас{whenTextByLang.mk}.</p>")
                : ("Барањето за состанок е примено", $"<p>Закажан е состанок <strong>{item.Subject}</strong>{whenTextByLang.mk}. Ќе добиете известување штом биде потврдено.</p>"),
        };
        var notification = new Notification
        {
            RecipientUserId = userId,
            Language = user.PreferredLanguage,
            Type = scheduledByAdmin ? "MeetingScheduledByAdmin" : "MeetingRequested",
            Subject = meetingSubject,
            Body = meetingBodyText,
            ActionUrl = "/portal?tab=meetings",
        };
        var auditLog = new AuditLog
        {
            ActorUserId = actorUserId,
            Action = scheduledByAdmin ? "MeetingScheduledByAdmin" : "MeetingRequested",
            EntityType = nameof(Meeting),
            EntityId = item.Id.ToString(),
        };
        var notifications = new List<Notification> { notification };
        if (!scheduledByAdmin)
        {
            // A client requesting a meeting is new work for the team — every admin/staff
            // member should hear about it by email too, not just see it if they happen to
            // check the portal. (When an admin schedules the meeting themselves, they
            // obviously already know about it, so this is skipped in that case.)
            var staffIds = await repository.GetStaffUserIdsAsync(ct);
            var clientName = $"{user.FirstName} {user.LastName}".Trim();
            var encodedClientName = System.Net.WebUtility.HtmlEncode(clientName);
            foreach (var staffId in staffIds)
            {
                var staffMember = await repository.FindUserAsync(staffId, ct);
                var (staffSubject, staffBody) = staffMember?.PreferredLanguage switch
                {
                    "en" => ("A client requested a meeting with you", $"<p>{encodedClientName} requested <strong>{item.Subject}</strong>{whenTextByLang.en}.</p>"),
                    "sq" => ("Një klient kërkoi një takim me ju", $"<p>{encodedClientName} kërkoi <strong>{item.Subject}</strong>{whenTextByLang.sq}.</p>"),
                    _ => ("Клиент закажа состанок со вас", $"<p>{encodedClientName} побара <strong>{item.Subject}</strong>{whenTextByLang.mk}.</p>"),
                };
                notifications.Add(new Notification
                {
                    RecipientUserId = staffId,
                    Language = staffMember?.PreferredLanguage,
                    Type = "MeetingRequestedByClient",
                    Subject = staffSubject,
                    Body = staffBody,
                    ActionUrl = "/staff?tab=meetings",
                });
            }
        }
        await repository.AddAsync(item, notifications, auditLog, ct);
        return item;
    }
}
