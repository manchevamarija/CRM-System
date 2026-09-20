using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Policy = "Admin")]
public sealed class AdminAuditController(PortalDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<object>> Get(
        int? page,
        int? pageSize,
        string? action,
        CancellationToken ct
    )
    {
        var logs = await db
            .AuditLogs.Where(x => action == null || x.Action == action)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(Offset(page, pageSize))
            .Take(Size(pageSize))
            .ToListAsync(ct);
        var actorIds = logs.Where(x => x.ActorUserId is not null).Select(x => x.ActorUserId!.Value).Distinct().ToArray();
        var actors = await db.Users
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim() == "" ? u.Email : $"{u.FirstName} {u.LastName}".Trim(), ct);
        return logs.Select(x => new
        {
            x.Id,
            x.ActorUserId,
            ActorName = x.ActorUserId is { } actorId && actors.TryGetValue(actorId, out var name) ? name : null,
            x.ActorIp,
            x.Action,
            x.EntityType,
            x.EntityId,
            x.OldValuesJson,
            x.NewValuesJson,
            x.MetadataJson,
            x.CreatedAt,
            x.TenantId,
        }).ToList();
    }
}
