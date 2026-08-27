using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static CRMSystem.Api.Web.Controllers.Client.ClientSupport;

namespace CRMSystem.Api.Web.Controllers.Client;

[ApiController]
[Route("api/meetings")]
[Authorize]
public sealed class MeetingsController(IMeetingService service, PortalDbContext db) : ControllerBase
{
    [HttpGet("my")]
    public async Task<object> Mine(CancellationToken ct)
    {
        var principal = User;
        var userId = principal.UserId();
        var items = await db
            .Meetings.IgnoreQueryFilters()
            .Where(item => item.RequestedByUserId == userId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(ct);
        var assignedIds = items.Where(item => item.AssignedUserId is not null).Select(item => item.AssignedUserId!.Value).Distinct().ToArray();
        var names = await db.Users.Where(user => assignedIds.Contains(user.Id)).ToDictionaryAsync(user => user.Id, user => $"{user.FirstName} {user.LastName}".Trim() == "" ? user.Email ?? "CRM System" : $"{user.FirstName} {user.LastName}".Trim(), ct);
        foreach (var item in items)
            item.AssignedUserName = item.AssignedUserId is { } id && names.TryGetValue(id, out var name) ? name : null;
        return items;
    }

    [HttpGet("calendar.ics")]
    public async Task<IResult> CalendarIcs(CancellationToken ct)
    {
        var principal = User;
        return Results.File(
            CalendarExport.Ics(
                await db
                    .Meetings.IgnoreQueryFilters()
                    .Where(x => x.RequestedByUserId == principal.UserId() && x.StartsAt != null)
                    .OrderBy(x => x.StartsAt)
                    .ToListAsync(ct)
            ),
            "text/calendar; charset=utf-8",
            "crm-system-meetings.ics"
        );
    }

    [HttpPost]
    public async Task<IResult> Create(MeetingRequest request, CancellationToken ct)
    {
        var principal = User;
        if (await service.CreateAsync(request, principal.UserId(), principal.UserId(), ct) is not { } item)
            return Results.BadRequest(new { message = "Барањето за состанок не можеше да се создаде." });
        await NotifyAdminsAsync(
            db,
            "MeetingRequested",
            $"Нов состанок побаран: {item.Subject}",
            $"<p>Состанок „{item.Subject}“ е побаран и чека потврда.</p>",
            "/staff?tab=meetings",
            ct
        );
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/meetings/{item.Id}", item);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IResult> Cancel(Guid id, CancellationToken ct)
    {
        var principal = User;
        var item = await FindClientMeetingAsync(id, principal.UserId(), ct);
        if (item is null)
            return Results.NotFound();
        if (item.Status is "Completed" or "Cancelled")
            return Results.Conflict();
        item.Status = "Cancelled";
        if (item.AssignedUserId is { } assignee)
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = assignee,
                    Type = "MeetingCancelled",
                    Subject = "Клиентот го откажа состанокот",
                    Body = $"<p>Состанокот „{item.Subject}“ е откажан.</p>",
                    ActionUrl = "/staff?tab=meetings",
                }
            );
        db.AuditLogs.Add(Audit(principal, "MeetingCancelled", nameof(Meeting), item.Id));
        await db.SaveChangesAsync(ct);
        return Results.Ok(item);
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<IResult> Confirm(Guid id, CancellationToken ct)
    {
        var principal = User;
        var userId = principal.UserId();
        var item = await FindClientMeetingAsync(id, userId, ct);
        if (item is null)
            return Results.NotFound(new { message = "Состанокот не е пронајден или не припаѓа на вашиот профил." });
        if (item.Status is "Completed" or "Cancelled" or "Rejected")
            return Results.Conflict();

        item.Status = "Confirmed";
        item.ConfirmedBy = userId;
        item.ConfirmedAt = DateTimeOffset.UtcNow;
        if (item.AssignedUserId is { } assignee)
            db.Notifications.Add(new Notification
            {
                RecipientUserId = assignee,
                Type = "MeetingConfirmedByClient",
                Subject = "Клиентот го потврди состанокот",
                Body = $"<p>Клиентот го потврди состанокот <strong>{item.Subject}</strong>.</p>",
                ActionUrl = "/staff?tab=meetings",
            });
        db.AuditLogs.Add(Audit(principal, "MeetingConfirmedByClient", nameof(Meeting), item.Id));
        await db.SaveChangesAsync(ct);
        return Results.Ok(item);
    }

    [HttpPost("{id:guid}/reschedule")]
    public async Task<IResult> Reschedule(
        Guid id,
        MeetingRescheduleRequest request,
        CancellationToken ct
    )
    {
        var principal = User;
        var item = await FindClientMeetingAsync(id, principal.UserId(), ct);
        if (item is null)
            return Results.NotFound();
        if (item.Status == "Completed")
            return Results.Conflict(new { message = "A completed meeting cannot be rescheduled." });
        if (
            request.PreferredStart is not null
            && request.PreferredEnd is not null
            && request.PreferredEnd <= request.PreferredStart
        )
            return Results.BadRequest(new { message = "The proposed end must be after the start." });

        item.StartsAt = request.PreferredStart;
        item.EndsAt = request.PreferredEnd;
        item.RequestedTimeWindow = request.RequestedTimeWindow?.Trim();
        item.Notes = request.Notes?.Trim();
        item.Status = "Requested";
        item.ConfirmedBy = null;
        item.ConfirmedAt = null;
        if (item.AssignedUserId is { } assignee)
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = assignee,
                    Type = "MeetingRescheduleRequested",
                    Subject = "Клиентот побара промена на термин",
                    Body = $"<p>Клиентот побара промена на термин за состанокот <strong>{item.Subject}</strong>.</p>",
                    ActionUrl = "/staff?tab=meetings",
                }
            );
        db.AuditLogs.Add(Audit(principal, "MeetingRescheduleRequested", nameof(Meeting), item.Id));
        await db.SaveChangesAsync(ct);
        return Results.Ok(item);
    }

    private Task<Meeting?> FindClientMeetingAsync(Guid id, Guid userId, CancellationToken ct) =>
        db.Meetings.IgnoreQueryFilters().SingleOrDefaultAsync(
            item => item.Id == id && item.RequestedByUserId == userId,
            ct
        );
}
