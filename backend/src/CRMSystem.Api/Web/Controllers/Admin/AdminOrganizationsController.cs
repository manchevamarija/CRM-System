using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "Admin")]
public sealed class AdminOrganizationsController(PortalDbContext db) : ControllerBase
{
    [HttpPost("organizations")]
    public async Task<IResult> Create(AdminOrganizationRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { message = "Organization name is required." });
        AppUser? client = null;
        if (request.ClientUserId is { } clientUserId)
        {
            client = await db.Users.SingleOrDefaultAsync(x => x.Id == clientUserId, ct);
            if (client is null) return Results.BadRequest(new { message = "Client not found." });
            if (client.OrganizationId is not null) return Results.Conflict(new { message = "Client already belongs to an organization." });
        }
        var brand = string.IsNullOrWhiteSpace(request.Brand) ? db.CurrentTenantId : request.Brand.Trim().ToLowerInvariant();
        if (!new[] { "digitmak", "bau", "vezilka", "hpc" }.Contains(brand, StringComparer.OrdinalIgnoreCase))
            return Results.BadRequest(new { message = "Unknown organization brand." });
        if (!db.IsGlobalScope && !string.Equals(brand, db.CurrentTenantId, StringComparison.OrdinalIgnoreCase))
            return Results.Forbid();
        var item = new Organization { Name = request.Name.Trim(), Brand = brand, Type = request.Type, Sector = request.Sector, Municipality = request.Municipality, Region = request.Region, Website = request.Website, EmployeeCount = request.EmployeeCount, Status = "Approved", CreatedByUserId = User.UserId(), ApprovedBy = User.UserId(), ApprovedAt = DateTimeOffset.UtcNow, ParentOrganizationId = request.ParentOrganizationId };
        db.Organizations.Add(item);
        if (client is not null)
        {
            client.OrganizationId = item.Id;
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = item.Id, UserId = client.Id, IsPrimaryContact = true, MemberStatus = "Active" });
            db.Notifications.Add(new Notification { RecipientUserId = client.Id, Type = "OrganizationAssigned", Subject = $"Доделени сте во организацијата {item.Name}", Body = "<p>Администраторот креираше организација и го поврза вашиот профил.</p>", ActionUrl = "/portal?tab=organization" });
        }
        db.AuditLogs.Add(Audit(User, "OrganizationCreatedByAdmin", nameof(Organization), item.Id));
        await db.SaveChangesAsync(ct); return Results.Created($"/api/admin/organizations/{item.Id}", item);
    }

    public sealed record AdminOrganizationRequest(string Name, string Type, string? Sector, string? Municipality, string? Region, string? Website, int? EmployeeCount, Guid? ClientUserId = null, Guid? ParentOrganizationId = null, string? Brand = null);

    public sealed record SetParentOrganizationRequest(Guid? ParentOrganizationId);

    [HttpPut("organizations/{id:guid}/parent")]
    public async Task<IResult> SetParent(Guid id, SetParentOrganizationRequest request, CancellationToken ct)
    {
        var item = await db.Organizations.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return Results.NotFound();
        if (request.ParentOrganizationId == id)
            return Results.BadRequest(new { message = "An organization cannot be its own parent." });
        if (request.ParentOrganizationId is not null)
        {
            var parentExists = await db.Organizations.AnyAsync(x => x.Id == request.ParentOrganizationId, ct);
            if (!parentExists) return Results.BadRequest(new { message = "Parent organization not found." });
            // Prevent creating a cycle (A -> B -> A) by walking up the chain from the
            // proposed parent — if we ever reach this organization, it's a cycle.
            var currentId = request.ParentOrganizationId;
            var guard = 0;
            while (currentId is not null && guard++ < 50)
            {
                if (currentId == id) return Results.BadRequest(new { message = "That would create a circular organization hierarchy." });
                currentId = await db.Organizations.Where(x => x.Id == currentId).Select(x => x.ParentOrganizationId).FirstOrDefaultAsync(ct);
            }
        }
        item.ParentOrganizationId = request.ParentOrganizationId;
        db.AuditLogs.Add(Audit(User, "OrganizationParentChanged", nameof(Organization), item.Id));
        await db.SaveChangesAsync(ct);
        return Results.Ok(item);
    }
    [HttpGet("organizations")]
    public async Task<IReadOnlyList<Organization>> Get(int? page, int? pageSize, CancellationToken ct) =>
        await db
            .Organizations.OrderByDescending(x => x.CreatedAt)
            .Skip(Offset(page, pageSize))
            .Take(Size(pageSize))
            .ToListAsync(ct);

    [HttpGet("organizations/{id:guid}")]
    public async Task<IResult> GetOne(Guid id, CancellationToken ct) =>
        await db.Organizations.FindAsync([id], ct) is { } item
            ? Results.Ok(
                new
                {
                    organization = item,
                    members = await db
                        .OrganizationMembers.Where(x => x.OrganizationId == id)
                        .Join(
                            db.Users,
                            x => x.UserId,
                            x => x.Id,
                            (member, user) =>
                                new
                                {
                                    member.Id,
                                    member.UserId,
                                    user.Email,
                                    user.FirstName,
                                    user.LastName,
                                    member.MemberStatus,
                                    member.IsPrimaryContact,
                                }
                        )
                        .ToListAsync(ct),
                }
            )
            : Results.NotFound();

    [HttpPost("organizations/{id:guid}/{operation}")]
    public async Task<IResult> ChangeStatus(Guid id, string operation)
    {
        var principal = User;
        var item = await db.Organizations.FindAsync(id);
        if (item is null)
            return Results.NotFound();
        var next = operation.ToLowerInvariant() switch
        {
            "approve" => "Approved",
            "reject" => "Rejected",
            "suspend" => "Suspended",
            "reactivate" => "Approved",
            _ => null,
        };
        if (next is null)
            return Results.BadRequest();
        if (
            operation.Equals("reactivate", StringComparison.OrdinalIgnoreCase)
            && item.Status != "Suspended"
        )
            return Results.Conflict(
                new { message = "Only a suspended organization can be reactivated." }
            );
        var old = item.Status;
        item.Status = next;
        if (next == "Approved")
        {
            item.ApprovedBy = principal.UserId();
            item.ApprovedAt = DateTimeOffset.UtcNow;
        }
        var recipients = await db
            .OrganizationMembers.Where(x => x.OrganizationId == id)
            .Select(x => x.UserId)
            .ToListAsync();
        if (!recipients.Contains(item.CreatedByUserId))
            recipients.Add(item.CreatedByUserId);
        var (orgSubject, orgBody) = next switch
        {
            "Approved" => (
                "Администраторот го одобри вашето барање",
                $"<p>Организацијата <strong>{item.Name}</strong> е одобрена. Можете да продолжите со претплата.</p>"
            ),
            "Rejected" => (
                "Администраторот го одби вашето барање",
                $"<p>Барањето за организацијата <strong>{item.Name}</strong> е одбиено.</p>"
            ),
            "Suspended" => (
                "Организацијата е суспендирана",
                $"<p>Организацијата <strong>{item.Name}</strong> е привремено суспендирана.</p>"
            ),
            _ => (
                "Статус на организација",
                $"<p>Организацијата <strong>{item.Name}</strong> е {next.ToLowerInvariant()}.</p>"
            ),
        };
        foreach (var recipient in recipients.Distinct())
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = recipient,
                    Type = $"Organization{next}",
                    Subject = orgSubject,
                    Body = orgBody,
                    ActionUrl = "/portal?tab=organization",
                }
            );
        db.AuditLogs.Add(
            Audit(
                principal,
                operation.Equals("reactivate", StringComparison.OrdinalIgnoreCase)
                    ? "OrganizationReactivated"
                    : $"Organization{next}",
                nameof(Organization),
                item.Id,
                old,
                next
            )
        );
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    [HttpPost("organization-members/{id:guid}/{operation}")]
    public async Task<IResult> ChangeMemberStatus(Guid id, string operation)
    {
        var principal = User;
        var member = await db.OrganizationMembers.FindAsync(id);
        if (member is null)
            return Results.NotFound();
        if (operation == "approve")
        {
            member.MemberStatus = "Active";
            var user = await db.Users.FindAsync(member.UserId);
            if (user is not null)
                user.OrganizationId = member.OrganizationId;
        }
        else if (operation == "reject")
            member.MemberStatus = "Rejected";
        else
            return Results.BadRequest();
        db.Notifications.Add(
            new Notification
            {
                RecipientUserId = member.UserId,
                Type = "OrganizationMembershipChanged",
                Subject =
                    operation == "approve"
                        ? "Администраторот го одобри вашето барање"
                        : "Администраторот го одби вашето барање",
                Body =
                    operation == "approve"
                        ? "<p>Вашето барање за членство во организацијата е одобрено.</p>"
                        : "<p>Вашето барање за членство во организацијата е одбиено.</p>",
                ActionUrl = "/portal?tab=organization",
            }
        );
        db.AuditLogs.Add(
            Audit(principal, $"OrganizationMember{operation}", nameof(OrganizationMember), member.Id)
        );
        await db.SaveChangesAsync();
        return Results.Ok(member);
    }

    public sealed record TransferClientRequest(Guid UserId, Guid ToOrganizationId);

    /// <summary>Moves a client from their current organization to a different one —
    /// e.g. from a parent chamber organization into one of its member sub-organizations,
    /// or between sibling sub-organizations. Keeps the client's history (contact
    /// requests, meetings, tickets) unaffected; only their current organization
    /// membership changes.</summary>
    [HttpPost("organizations/transfer-client")]
    public async Task<IResult> TransferClient(TransferClientRequest request, CancellationToken ct)
    {
        var client = await db.Users.FirstOrDefaultAsync(x => x.Id == request.UserId, ct);
        if (client is null) return Results.NotFound(new { message = "Client not found." });
        var toOrganization = await db.Organizations.FirstOrDefaultAsync(x => x.Id == request.ToOrganizationId, ct);
        if (toOrganization is null) return Results.BadRequest(new { message = "Target organization not found." });

        var fromOrganizationId = client.OrganizationId;
        var existingMembership = await db.OrganizationMembers
            .Where(x => x.UserId == client.Id && x.OrganizationId == fromOrganizationId)
            .FirstOrDefaultAsync(ct);
        if (existingMembership is not null)
            db.OrganizationMembers.Remove(existingMembership);

        client.OrganizationId = toOrganization.Id;
        var alreadyMember = await db.OrganizationMembers
            .AnyAsync(x => x.UserId == client.Id && x.OrganizationId == toOrganization.Id, ct);
        if (!alreadyMember)
        {
            db.OrganizationMembers.Add(new OrganizationMember
            {
                OrganizationId = toOrganization.Id,
                UserId = client.Id,
                IsPrimaryContact = true,
                MemberStatus = "Active",
            });
        }

        db.Notifications.Add(new Notification
        {
            RecipientUserId = client.Id,
            Type = "OrganizationAssigned",
            Subject = $"Префрлени сте во организацијата {toOrganization.Name}",
            Body = "<p>Администраторот ве префрли во друга организација.</p>",
            ActionUrl = "/portal?tab=organization",
        });
        db.AuditLogs.Add(Audit(User, "ClientTransferredToOrganization", nameof(AppUser), client.Id,
            oldValue: fromOrganizationId?.ToString(), newValue: toOrganization.Id.ToString()));
        await db.SaveChangesAsync(ct);
        return Results.Ok();
    }
}
