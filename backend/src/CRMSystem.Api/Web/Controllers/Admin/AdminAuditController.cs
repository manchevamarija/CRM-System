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
    public async Task<IReadOnlyList<AuditLog>> Get(
        int? page,
        int? pageSize,
        string? action,
        CancellationToken ct
    ) =>
        await db
            .AuditLogs.Where(x => action == null || x.Action == action)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(Offset(page, pageSize))
            .Take(Size(pageSize))
            .ToListAsync(ct);
}
