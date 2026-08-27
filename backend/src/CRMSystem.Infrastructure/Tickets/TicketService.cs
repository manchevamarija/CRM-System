using System.Security.Claims;
using System.Text.Json;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Infrastructure.Persistence.Repositories;
using CRMSystem.Application;
using CRMSystem.Application.Realtime;

namespace CRMSystem.Infrastructure.Services;

public sealed class TicketService(
    ITicketRepository repository,
    IRealtimeTicketNotifier notifier,
    TicketPresenceTracker presence
) : ITicketService
{
    private static readonly HashSet<string> Categories =
    [
        "AI_READINESS",
        "AI_ACT_COMPLIANCE",
        "AI_USE_CASE",
        "DATA_GOVERNANCE",
        "AUTOMATION_AND_INTELLIGENCE",
        "DIGITALIZATION_ROADMAP",
        "TEST_BEFORE_INVEST",
        "TRAINING_AND_SKILLS",
        "FUNDING_AND_INVESTMENT",
        "REFERRAL",
        "OTHER",
    ];
    private static readonly HashSet<string> Priorities = ["Low", "Normal", "High", "Urgent"];

    public async Task<IReadOnlyList<Ticket>> GetMineAsync(Guid userId, CancellationToken ct) =>
        await repository.ListCreatedByAsync(userId, ct);

    public async Task<Ticket?> GetVisibleAsync(Guid id, ClaimsPrincipal p, CancellationToken ct)
    {
        var item = await repository.FindAsync(id, ct);
        if (item is null)
            return null;
        var userId = p.UserId();
        return
            item.CreatedByUserId == userId
            || item.AssignedAgentId == userId
            || item.AssignedExpertId == userId
            || p.IsInRole("Admin")
            ? item
            : null;
    }

    public Task<Ticket?> CreateAsync(TicketRequest r, Guid userId, CancellationToken ct) =>
        CreateForUserAsync(r, userId, userId, null, ct);

    public async Task<Ticket?> CreateForUserAsync(
        TicketRequest r,
        Guid userId,
        Guid actorUserId,
        Guid? expectedOrganizationId,
        CancellationToken ct
    )
    {
        var now = DateTimeOffset.UtcNow;
        var user = await repository.FindUserAsync(userId, ct);
        var createdByStaff = actorUserId != userId;
        if (
            user is null
            || (!createdByStaff
                && (user.OrganizationId is null
                    || !await repository.HasPortalAccessAsync(userId, user.OrganizationId.Value, now, ct)))
            || (expectedOrganizationId is not null
                && user.OrganizationId is not null
                && user.OrganizationId != expectedOrganizationId)
        )
            return null;
        if (
            !Categories.Contains(r.Category)
            || !Priorities.Contains(r.Priority ?? "Normal")
            || string.IsNullOrWhiteSpace(r.Title)
            || string.IsNullOrWhiteSpace(r.Description)
        )
            throw new ArgumentException("Invalid ticket category, priority, title or description.");
        var year = now.Year;
        var yearStart = new DateTimeOffset(year, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var yearEnd = yearStart.AddYears(1);
        var count = await repository.CountCreatedBetweenAsync(yearStart, yearEnd, ct);
        var item = new Ticket
        {
            TicketNumber = $"DM-{year}-{count + 1:0000}",
            OrganizationId = expectedOrganizationId ?? user.OrganizationId ?? Guid.Empty,
            CreatedByUserId = userId,
            Category = r.Category,
            Title = r.Title.Trim(),
            Description = r.Description.Trim(),
            Priority = r.Priority ?? "Normal",
        };
        var notification = new Notification
        {
            RecipientUserId = userId,
            Type = "TicketCreated",
            Subject = $"Тикетот {item.TicketNumber} е креиран",
            Body = $"<p>Вашиот тикет <strong>{item.Title}</strong> е креиран.</p>",
            ActionUrl = $"/portal?tab=tickets&ticket={item.Id}",
        };
        var notifications = new List<Notification> { notification };
        if (item.Priority is "Urgent" or "High")
        {
            var staffUserIds = await repository.GetStaffUserIdsAsync(ct);
            var priorityLabel = item.Priority == "Urgent" ? "итен" : "висок";
            notifications.AddRange(
                staffUserIds.Select(staffUserId => new Notification
                {
                    RecipientUserId = staffUserId,
                    Type = "TicketCreated",
                    Subject = $"Нов тикет со {priorityLabel} приоритет: {item.TicketNumber}",
                    Body =
                        $"<p>Креиран е нов тикет <strong>{item.Title}</strong> со {priorityLabel} приоритет.</p>",
                    ActionUrl = $"/staff?tab=tickets&ticket={item.Id}",
                })
            );
        }
        var auditLog = new AuditLog
        {
            ActorUserId = actorUserId,
            Action = actorUserId == userId ? "TicketCreated" : "TicketCreatedOnBehalf",
            EntityType = nameof(Ticket),
            EntityId = item.Id.ToString(),
            MetadataJson =
                actorUserId == userId
                    ? null
                    : JsonSerializer.Serialize(
                        new { ClientUserId = userId, OrganizationId = expectedOrganizationId ?? user.OrganizationId }
                    ),
        };
        await repository.AddTicketAsync(item, notifications, auditLog, ct);
        return item;
    }

    public async Task<IReadOnlyList<TicketMessage>> GetMessagesAsync(
        Guid id,
        ClaimsPrincipal p,
        CancellationToken ct
    )
    {
        if (await GetVisibleAsync(id, p, ct) is null)
            return [];
        var staff = p.IsInRole("Admin") || p.IsInRole("HelpDeskAgent") || p.IsInRole("Expert");
        return await repository.ListMessagesAsync(id, staff, ct);
    }

    public async Task<TicketMessage?> AddMessageAsync(
        Guid id,
        string body,
        string type,
        ClaimsPrincipal p,
        CancellationToken ct
    )
    {
        var ticket = await GetVisibleAsync(id, p, ct);
        if (ticket is null)
            return null;
        if (string.IsNullOrWhiteSpace(body))
            throw new ArgumentException("Message cannot be empty.");
        var item = new TicketMessage
        {
            TicketId = id,
            SenderUserId = p.UserId(),
            MessageType = type,
            Body = body.Trim(),
        };
        var recipients = new[] { ticket.CreatedByUserId, ticket.AssignedAgentId, ticket.AssignedExpertId }
            .Where(x => x is not null && x != p.UserId())
            .Select(x => x!.Value)
            .Distinct();
        var notifications = recipients
            .Where(recipient => !presence.IsPresent(id, recipient))
            .Select(recipient => new Notification
            {
                RecipientUserId = recipient,
                Type = "TicketMessageCreated",
                Subject = $"Нова порака на тикет {ticket.TicketNumber}",
                Body = $"<p>Има нова порака на тикетот <strong>{ticket.Title}</strong>.</p>",
                ActionUrl =
                    recipient == ticket.CreatedByUserId
                        ? $"/portal?tab=tickets&ticket={id}"
                        : $"/staff?tab=tickets&ticket={id}",
            })
            .ToArray();
        var auditLog = new AuditLog
        {
            ActorUserId = p.UserId(),
            Action = type + "Created",
            EntityType = nameof(TicketMessage),
            EntityId = item.Id.ToString(),
        };
        await repository.AddMessageAsync(item, notifications, auditLog, ct);
        await notifier.NotifyMessageCreatedAsync(id, item, ct);
        return item;
    }
}
