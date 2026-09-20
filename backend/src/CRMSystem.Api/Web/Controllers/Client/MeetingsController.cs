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
public sealed class MeetingsController(IMeetingService service, PortalDbContext db, ICalendarSyncService calendarSync) : ControllerBase
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
        var names = await db.Users.Where(user => assignedIds.Contains(user.Id)).ToDictionaryAsync(user => user.Id, user => $"{user.FirstName} {user.LastName}".Trim() == "" ? user.Email ?? "Тимот" : $"{user.FirstName} {user.LastName}".Trim(), ct);
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
        {
            var assigneeLanguage = await db.Users.Where(u => u.Id == assignee).Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct);
            var (cancelSubject, cancelBody) = assigneeLanguage switch
            {
                "en" => ("The client cancelled the meeting", $"<p>The meeting \"{item.Subject}\" has been cancelled.</p>"),
                "sq" => ("Klienti anuloi takimin", $"<p>Takimi \"{item.Subject}\" është anuluar.</p>"),
                _ => ("Клиентот го откажа состанокот", $"<p>Состанокот „{item.Subject}“ е откажан.</p>"),
            };
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = assignee,
                    Language = assigneeLanguage,
                    Type = "MeetingCancelled",
                    Subject = cancelSubject,
                    Body = cancelBody,
                    ActionUrl = "/staff?tab=meetings",
                }
            );
        }
        db.AuditLogs.Add(Audit(principal, "MeetingCancelled", nameof(Meeting), item.Id));
        await db.SaveChangesAsync(ct);
        await calendarSync.DeleteExternalEventAsync(item.Id, ct);
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
        {
            var assigneeLanguage = await db.Users.Where(u => u.Id == assignee).Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct);
            var (confirmSubject, confirmBody) = assigneeLanguage switch
            {
                "en" => ("The client confirmed the meeting", $"<p>The client confirmed <strong>{item.Subject}</strong>.</p>"),
                "sq" => ("Klienti konfirmoi takimin", $"<p>Klienti konfirmoi <strong>{item.Subject}</strong>.</p>"),
                _ => ("Клиентот го потврди состанокот", $"<p>Клиентот го потврди состанокот <strong>{item.Subject}</strong>.</p>"),
            };
            db.Notifications.Add(new Notification
            {
                RecipientUserId = assignee,
                Language = assigneeLanguage,
                Type = "MeetingConfirmedByClient",
                Subject = confirmSubject,
                Body = confirmBody,
                ActionUrl = "/staff?tab=meetings",
            });
        }
        db.AuditLogs.Add(Audit(principal, "MeetingConfirmedByClient", nameof(Meeting), item.Id));
        await db.SaveChangesAsync(ct);
        // The staff-side confirmation path pushes to the assignee's calendar — this
        // client-side confirmation (accepting a proposed time) is a second way a meeting
        // can end up "Confirmed" and was missing that same push entirely.
        await calendarSync.PushMeetingAsync(item.Id, ct);
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
        {
            var assigneeLanguage = await db.Users.Where(u => u.Id == assignee).Select(u => u.PreferredLanguage).FirstOrDefaultAsync(ct);
            var (rescheduleSubject, rescheduleBody) = assigneeLanguage switch
            {
                "en" => ("The client requested a new time", $"<p>The client requested a new time for <strong>{item.Subject}</strong>.</p>"),
                "sq" => ("Klienti kërkoi një orar të ri", $"<p>Klienti kërkoi një orar të ri për <strong>{item.Subject}</strong>.</p>"),
                _ => ("Клиентот побара промена на термин", $"<p>Клиентот побара промена на термин за состанокот <strong>{item.Subject}</strong>.</p>"),
            };
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = assignee,
                    Language = assigneeLanguage,
                    Type = "MeetingRescheduleRequested",
                    Subject = rescheduleSubject,
                    Body = rescheduleBody,
                    ActionUrl = "/staff?tab=meetings",
                }
            );
        }
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
