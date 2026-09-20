using CRMSystem.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Api.Web.Controllers.Notifications;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(PortalDbContext db) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<object> Mine(CancellationToken ct)
    {
        var principal = User;
        var userId = principal.UserId();
        return await db
            .Notifications.IgnoreQueryFilters()
            .Where(x => x.RecipientUserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(30)
            .Select(x => new
            {
                x.Id,
                x.Type,
                x.Subject,
                x.Body,
                x.ActionUrl,
                x.IsRead,
                x.CreatedAt,
            })
            .ToListAsync(ct);
    }

    [HttpGet("unread-count")]
    public async Task<object> UnreadCount(CancellationToken ct)
    {
        var principal = User;
        var userId = principal.UserId();
        return new
        {
            count = await db.Notifications.IgnoreQueryFilters().CountAsync(
                x => x.RecipientUserId == userId && !x.IsRead,
                ct
            ),
        };
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IResult> MarkRead(Guid id, CancellationToken ct)
    {
        var principal = User;
        var updated = await db
            .Notifications.IgnoreQueryFilters()
            .Where(x => x.Id == id && x.RecipientUserId == principal.UserId())
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsRead, true), ct);
        if (updated == 0)
            return Results.NotFound();
        return Results.NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IResult> MarkAllRead(CancellationToken ct)
    {
        var principal = User;
        var userId = principal.UserId();
        await db
            .Notifications.IgnoreQueryFilters()
            .Where(x => x.RecipientUserId == userId && !x.IsRead)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsRead, true), ct);
        return Results.NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IResult> Delete(Guid id, CancellationToken ct)
    {
        var principal = User;
        var deleted = await db
            .Notifications.IgnoreQueryFilters()
            .Where(x => x.Id == id && x.RecipientUserId == principal.UserId())
            .ExecuteDeleteAsync(ct);
        if (deleted == 0)
            return Results.NotFound();
        return Results.NoContent();
    }
}
