using System.Text.Json;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

[ApiController]
[Route("api/admin/meetings")]
[Authorize(Policy = "Admin")]
public sealed class AdminMeetingsController(IMeetingService meetings, PortalDbContext db) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IReadOnlyList<Meeting>> Mine(CancellationToken ct)
    {
        var principal = User;
        return await meetings.GetScheduledByMeAsync(principal.UserId(), ct);
    }

    [HttpPost]
    public async Task<IResult> Create(AdminMeetingRequest request, CancellationToken ct)
    {
        var principal = User;
        var item = await meetings.CreateAsync(request.Meeting, principal.UserId(), request.UserId, ct);
        if (item is null)
            return Results.BadRequest(
                new
                {
                    message = "Избраниот клиент не постои.",
                }
            );
        db.AuditLogs.Add(
            new AuditLog
            {
                ActorUserId = principal.UserId(),
                Action = "MeetingCreatedByAdmin",
                EntityType = nameof(Meeting),
                EntityId = item.Id.ToString(),
                MetadataJson = JsonSerializer.Serialize(new { request.UserId }),
            }
        );
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/meetings/{item.Id}", item);
    }
}
