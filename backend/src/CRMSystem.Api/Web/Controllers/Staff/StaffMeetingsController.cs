using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using static CRMSystem.Api.Web.Controllers.Staff.StaffSupport;

namespace CRMSystem.Api.Web.Controllers.Staff;

[ApiController]
[Route("api/staff/meetings")]
[Authorize(Policy = "Staff")]
public sealed class StaffMeetingsController(PortalDbContext db, ICalendarSyncService calendarSync) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<Meeting>> Get(DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct)
    {
        var principal = User;
        return await VisibleMeetings(db, principal)
            .Where(x => (from == null || x.StartsAt >= from) && (to == null || x.StartsAt <= to))
            .OrderBy(x => x.StartsAt)
            .ToListAsync(ct);
    }

    [HttpGet("calendar.ics")]
    public async Task<IResult> CalendarIcs(CancellationToken ct)
    {
        var principal = User;
        return Results.File(
            CalendarExport.Ics(
                await VisibleMeetings(db, principal)
                    .Where(x => x.StartsAt != null)
                    .OrderBy(x => x.StartsAt)
                    .ToListAsync(ct)
            ),
            "text/calendar; charset=utf-8",
            "crm-system-staff-calendar.ics"
        );
    }

    [HttpPost("{id:guid}/{operation}")]
    public async Task<IResult> Decide(Guid id, string operation, MeetingDecisionRequest request)
    {
        var principal = User;
        var item = await db.Meetings.FindAsync(id);
        if (item is null)
            return Results.NotFound();
        var canTriage =
            principal.IsInRole("Admin")
            || (principal.IsInRole("HelpDeskAgent") && item.AssignedUserId is null);
        if (!canTriage && item.AssignedUserId != principal.UserId())
            return Results.Forbid();
        var next = operation.ToLowerInvariant() switch
        {
            "confirm" => "Confirmed",
            "reject" => "Rejected",
            "complete" => "Completed",
            "propose" => "Requested",
            _ => null,
        };
        if (next is null)
            return Results.BadRequest();
        item.Status = next;
        item.StartsAt = request.StartsAt ?? item.StartsAt;
        item.EndsAt = request.EndsAt ?? item.EndsAt;
        item.Location = request.Location ?? item.Location;
        item.OnlineLink = request.OnlineLink ?? item.OnlineLink;
        item.Notes = request.Notes ?? item.Notes;
        if (request.OrganizationId is { } organizationId)
            item.OrganizationId = organizationId;
        item.AssignedUserId = request.AssignedUserId ?? item.AssignedUserId ?? principal.UserId();
        if (next == "Confirmed")
        {
            item.ConfirmedBy = principal.UserId();
            item.ConfirmedAt = DateTimeOffset.UtcNow;
        }
        var whenText = item.StartsAt is { } startsAt
            ? $" на {startsAt.ToSkopje():dd.MM.yyyy} во {startsAt.ToSkopje():HH:mm}"
            : "";
        var whenTextEn = item.StartsAt is { } startsAtEn
            ? $" on {startsAtEn.ToSkopje():dd.MM.yyyy} at {startsAtEn.ToSkopje():HH:mm}"
            : "";
        var whenTextSq = item.StartsAt is { } startsAtSq
            ? $" më {startsAtSq.ToSkopje():dd.MM.yyyy} në {startsAtSq.ToSkopje():HH:mm}"
            : "";
        var requesterLanguage = await db.Users
            .Where(u => u.Id == item.RequestedByUserId)
            .Select(u => u.PreferredLanguage)
            .FirstOrDefaultAsync();
        var (meetingSubject, meetingBody) = (requesterLanguage, next) switch
        {
            ("en", "Confirmed") => ("The administrator scheduled your meeting", $"<p><strong>{item.Subject}</strong> is confirmed{whenTextEn}.</p>"),
            ("en", "Rejected") => ("The administrator rejected the meeting request", $"<p>The request for <strong>{item.Subject}</strong> has been rejected.</p>"),
            ("en", "Completed") => ("Meeting completed", $"<p><strong>{item.Subject}</strong> has been marked as completed.</p>"),
            ("en", _) => ("A new time has been proposed for the meeting", $"<p>A new time has been proposed for <strong>{item.Subject}</strong>.</p>"),
            ("sq", "Confirmed") => ("Administratori planifikoi takimin tuaj", $"<p><strong>{item.Subject}</strong> është konfirmuar{whenTextSq}.</p>"),
            ("sq", "Rejected") => ("Administratori refuzoi kërkesën për takim", $"<p>Kërkesa për <strong>{item.Subject}</strong> është refuzuar.</p>"),
            ("sq", "Completed") => ("Takimi përfundoi", $"<p><strong>{item.Subject}</strong> është shënuar si i përfunduar.</p>"),
            ("sq", _) => ("Është propozuar një orar i ri për takimin", $"<p>Është propozuar një orar i ri për <strong>{item.Subject}</strong>.</p>"),
            (_, "Confirmed") => ("Администраторот го закажа вашиот состанок", $"<p><strong>{item.Subject}</strong> е потврден{whenText}.</p>"),
            (_, "Rejected") => ("Администраторот го одби барањето за состанок", $"<p>Барањето за <strong>{item.Subject}</strong> е одбиено.</p>"),
            (_, "Completed") => ("Состанокот е завршен", $"<p><strong>{item.Subject}</strong> е означен како завршен.</p>"),
            _ => ("Предложен е нов термин за состанокот", $"<p>Предложен е нов термин за <strong>{item.Subject}</strong>.</p>"),
        };
        db.Notifications.Add(
            new Notification
            {
                RecipientUserId = item.RequestedByUserId,
                Language = requesterLanguage,
                Type = $"Meeting{next}",
                Subject = meetingSubject,
                Body = meetingBody,
                ActionUrl = "/portal?tab=meetings",
            }
        );
        db.AuditLogs.Add(Audit(principal, $"Meeting{next}", item.Id));
        await db.SaveChangesAsync();
        if (next == "Confirmed")
            await calendarSync.PushMeetingAsync(item.Id, CancellationToken.None);
        else if (next == "Rejected")
            await calendarSync.DeleteExternalEventAsync(item.Id, CancellationToken.None);
        return Results.Ok(item);
    }
}
