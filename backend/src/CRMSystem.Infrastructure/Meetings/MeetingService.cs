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
        var notification = new Notification
        {
            RecipientUserId = userId,
            Type = scheduledByAdmin ? "MeetingScheduledByAdmin" : "MeetingRequested",
            Subject = scheduledByAdmin
                ? "Администраторот побара состанок со вас"
                : "Барањето за состанок е примено",
            Body = scheduledByAdmin
                ? $"<p>Администраторот побара состанок <strong>{item.Subject}</strong> со вас.</p>"
                : $"<p>Вашето барање за состанок <strong>{item.Subject}</strong> е примено.</p>",
            ActionUrl = "/portal?tab=meetings",
        };
        var auditLog = new AuditLog
        {
            ActorUserId = actorUserId,
            Action = scheduledByAdmin ? "MeetingScheduledByAdmin" : "MeetingRequested",
            EntityType = nameof(Meeting),
            EntityId = item.Id.ToString(),
        };
        await repository.AddAsync(item, notification, auditLog, ct);
        return item;
    }
}
