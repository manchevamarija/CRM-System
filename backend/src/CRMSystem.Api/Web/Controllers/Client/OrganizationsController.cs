using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using static CRMSystem.Api.Web.Controllers.Client.ClientSupport;

namespace CRMSystem.Api.Web.Controllers.Client;

[ApiController]
[Route("api/organizations")]
[Authorize]
public sealed class OrganizationsController(PortalDbContext db)
    : ControllerBase
{
    [HttpPost]
    public IResult Create(OrganizationRequest request) => Results.Json(new { code = "ADMIN_MANAGED_ORGANIZATIONS", message = "Organizations are created and assigned by an administrator." }, statusCode: StatusCodes.Status403Forbidden);

    [HttpPost("{id:guid}/join")]
    public IResult Join(Guid id) => Results.Json(new { code = "ADMIN_MANAGED_ORGANIZATIONS", message = "Organization membership is managed by an administrator." }, statusCode: StatusCodes.Status403Forbidden);

    [HttpGet("available")]
    public async Task<IResult> Available(CancellationToken ct) =>
        Results.Ok(
            await db
                .Organizations.Where(x => x.Status == "Approved")
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.Type,
                    x.Region,
                })
                .OrderBy(x => x.Name)
                .ToListAsync(ct)
        );

    [HttpGet("my")]
    public async Task<IResult> Mine(CancellationToken ct)
    {
        var principal = User;
        var organizationId = await db
            .Users.Where(x => x.Id == principal.UserId())
            .Select(x => x.OrganizationId)
            .SingleOrDefaultAsync(ct);
        return organizationId is not null
            && await db.Organizations.FindAsync([organizationId.Value], ct) is { } item
            ? Results.Ok(item)
            : Results.NotFound();
    }

    [HttpPatch("my")]
    public async Task<IResult> UpdateMine(OrganizationRequest request)
    {
        var principal = User;
        var user = await db.Users.FindAsync(principal.UserId());
        if (user?.OrganizationId is null)
            return Results.NotFound();
        var item = await db.Organizations.FindAsync(user.OrganizationId.Value);
        if (item is null)
            return Results.NotFound();
        item.Name = request.Name;
        item.Type = request.Type;
        item.Sector = request.Sector;
        item.Municipality = request.Municipality;
        item.Region = request.Region;
        item.Website = request.Website;
        item.EmployeeCount = request.EmployeeCount;
        item.Status = "PendingApproval";
        db.AuditLogs.Add(Audit(principal, "OrganizationUpdated", nameof(Organization), item.Id));
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }
}
