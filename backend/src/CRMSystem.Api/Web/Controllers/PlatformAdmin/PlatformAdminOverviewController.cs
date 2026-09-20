using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Application.Tenancy;
using CRMSystem.Infrastructure.Persistence;
using System.Text.Json;

namespace CRMSystem.Api.Web.Controllers.PlatformAdmin;

[ApiController]
[Route("api/platform-admin")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformAdminOverviewController(
    PortalDbContext db,
    ITenantDirectory tenants,
    UserManager<AppUser> users
) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<PlatformOverviewResponse> Overview(CancellationToken ct)
    {
        var tenantRows = tenants.All
            .OrderBy(tenant => tenant.Name)
            .Select(tenant => new PlatformTenantRow(
                tenant.Id,
                tenant.Name,
                tenant.LegalName,
                tenant.SupportEmail,
                tenant.PrimaryColor,
                tenant.AccentColor,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0))
            .ToDictionary(tenant => tenant.Id, StringComparer.OrdinalIgnoreCase);

        var organizationCounts = await CountByTenant(db.Organizations.IgnoreQueryFilters(), ct);
        var ticketCounts = await CountByTenant(db.Tickets.IgnoreQueryFilters(), ct);
        var meetingCounts = await CountByTenant(db.Meetings.IgnoreQueryFilters(), ct);
        var subscriptionCounts = await db.Subscriptions
            .IgnoreQueryFilters()
            .Where(subscription => subscription.Status == "Active")
            .GroupBy(subscription => subscription.TenantId)
            .Select(group => new TenantCount(group.Key, group.Count()))
            .ToListAsync(ct);
        var membershipCounts = await CountByTenant(db.UserTenantMemberships.IgnoreQueryFilters(), ct);
        var auditCounts = await db.AuditLogs
            .IgnoreQueryFilters()
            .GroupBy(audit => audit.TenantId)
            .Select(group => new TenantCount(group.Key, group.Count()))
            .ToListAsync(ct);
        var contactCounts = await db.ContactRequests
            .IgnoreQueryFilters()
            .GroupBy(request => request.OwnerTenantId)
            .Select(group => new TenantCount(group.Key, group.Count()))
            .ToListAsync(ct);
        var contactRows = await db.ContactRequests
            .IgnoreQueryFilters()
            .Select(request => new
            {
                request.OwnerTenantId,
                request.Status,
                request.CreatedAt,
                request.UpdatedAt,
                request.ServiceItemsJson,
            })
            .ToListAsync(ct);
        var crmMetrics = contactRows
            .GroupBy(request => request.OwnerTenantId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var completed = group.Where(request => request.Status == "Served").ToArray();
                    var serviceRows = group.SelectMany(request => ParseServices(request.ServiceItemsJson)).ToArray();
                    var overdue = serviceRows.Count(service =>
                        service.Deadline < DateTimeOffset.UtcNow && service.Status != "Completed");
                    return new TenantCrmMetrics(
                        completed.Length,
                        completed.Length == 0
                            ? 0
                            : Math.Round(completed.Average(request =>
                                Math.Max(0, (request.UpdatedAt - request.CreatedAt).TotalDays)), 1),
                        serviceRows.Where(service => service.Price is not null).Sum(service => service.Price!.Value),
                        overdue);
                },
                StringComparer.OrdinalIgnoreCase);

        var rows = tenantRows.Values
            .Select(tenant => tenant with
            {
                Organizations = Value(organizationCounts, tenant.Id),
                ContactRequests = Value(contactCounts, tenant.Id),
                CompletedContactRequests = crmMetrics.TryGetValue(tenant.Id, out var metrics)
                    ? metrics.CompletedContactRequests
                    : 0,
                AverageDaysToServe = crmMetrics.TryGetValue(tenant.Id, out metrics)
                    ? metrics.AverageDaysToServe
                    : 0,
                TotalServiceValue = crmMetrics.TryGetValue(tenant.Id, out metrics)
                    ? metrics.TotalServiceValue
                    : 0,
                OverdueServices = crmMetrics.TryGetValue(tenant.Id, out metrics)
                    ? metrics.OverdueServices
                    : 0,
                Tickets = Value(ticketCounts, tenant.Id),
                Meetings = Value(meetingCounts, tenant.Id),
                ActiveSubscriptions = Value(subscriptionCounts, tenant.Id),
                StaffMemberships = Value(membershipCounts, tenant.Id),
                AuditEvents = Value(auditCounts, tenant.Id),
            })
            .ToArray();

        var recentAudit = await db.AuditLogs
            .IgnoreQueryFilters()
            .OrderByDescending(audit => audit.CreatedAt)
            .Take(20)
            .Select(audit => new PlatformAuditRow(
                audit.Id,
                audit.TenantId,
                audit.Action,
                audit.EntityType,
                audit.EntityId,
                audit.ActorUserId,
                audit.CreatedAt))
            .ToListAsync(ct);

        var platformAdmins = await GetUsersInRoleAsync(PortalRoles.PlatformAdmin);

        return new PlatformOverviewResponse(
            rows,
            new PlatformTotals(
                rows.Sum(row => row.Organizations),
                rows.Sum(row => row.ContactRequests),
                rows.Sum(row => row.Tickets),
                rows.Sum(row => row.Meetings),
                rows.Sum(row => row.ActiveSubscriptions),
                rows.Sum(row => row.StaffMemberships),
                await db.Users.CountAsync(ct),
                platformAdmins.Count,
                rows.Sum(row => row.CompletedContactRequests),
                rows.Length == 0 ? 0 : Math.Round(rows.Average(row => row.AverageDaysToServe), 1),
                rows.Sum(row => row.TotalServiceValue),
                rows.Sum(row => row.OverdueServices)),
            recentAudit);
    }

    [HttpGet("users")]
    public async Task<IReadOnlyList<PlatformUserRow>> Users(CancellationToken ct)
    {
        var membershipRows = await db.UserTenantMemberships
            .IgnoreQueryFilters()
            .Select(item => new
            {
                item.UserId,
                Membership = new PlatformMembershipRow(item.TenantId, item.AccessLevel),
            })
            .ToListAsync(ct);
        var membershipLookup = membershipRows
            .GroupBy(item => item.UserId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.Membership).OrderBy(item => item.TenantId).ToArray());
        var roleRows = await db.UserRoles
            .Join(
                db.Roles,
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, role) => new { userRole.UserId, Role = role.Name! })
            .Where(item => item.Role != null)
            .ToListAsync(ct);
        var roleLookup = roleRows
            .GroupBy(item => item.UserId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.Role).OrderBy(role => role).ToArray());
        var allUsers = await db.Users
            .OrderBy(user => user.Email)
            .Select(user => new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                user.Status,
                user.EmailVerifiedAt,
                user.LastLoginAt,
                user.CreatedAt,
            })
            .ToListAsync(ct);

        var rows = new List<PlatformUserRow>(allUsers.Count);
        foreach (var user in allUsers)
        {
            rows.Add(new PlatformUserRow(
                user.Id,
                user.Email ?? "",
                user.FirstName,
                user.LastName,
                user.Status,
                user.EmailVerifiedAt,
                user.LastLoginAt,
                user.CreatedAt,
                roleLookup.TryGetValue(user.Id, out var userRoles) ? userRoles : [],
                membershipLookup.TryGetValue(user.Id, out var userMemberships) ? userMemberships : []));
        }

        return rows;
    }

    private static async Task<IReadOnlyList<TenantCount>> CountByTenant<T>(
        IQueryable<T> query,
        CancellationToken ct
    )
        where T : ITenantOwned =>
        await query
            .GroupBy(item => item.TenantId)
            .Select(group => new TenantCount(group.Key, group.Count()))
            .ToListAsync(ct);

    private async Task<IReadOnlyList<AppUser>> GetUsersInRoleAsync(string role) =>
        (await users.GetUsersInRoleAsync(role)).ToArray();

    private static int Value(IReadOnlyList<TenantCount> counts, string tenantId) =>
        counts.FirstOrDefault(count => count.TenantId.Equals(tenantId, StringComparison.OrdinalIgnoreCase))?.Count ?? 0;

    private static IReadOnlyList<PlatformServiceRow> ParseServices(string json)
    {
        try { return JsonSerializer.Deserialize<PlatformServiceRow[]>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? []; }
        catch { return []; }
    }

    private sealed record TenantCount(string TenantId, int Count);
    private sealed record TenantCrmMetrics(int CompletedContactRequests, double AverageDaysToServe, decimal TotalServiceValue, int OverdueServices);
    private sealed record PlatformServiceRow(string Name, string Status, decimal? Price, DateTimeOffset? Deadline);
}

public sealed record PlatformOverviewResponse(
    IReadOnlyList<PlatformTenantRow> Tenants,
    PlatformTotals Totals,
    IReadOnlyList<PlatformAuditRow> RecentAudit
);

public sealed record PlatformTenantRow(
    string Id,
    string Name,
    string LegalName,
    string SupportEmail,
    string PrimaryColor,
    string AccentColor,
    int Organizations,
    int ContactRequests,
    int CompletedContactRequests,
    double AverageDaysToServe,
    decimal TotalServiceValue,
    int OverdueServices,
    int Tickets,
    int Meetings,
    int ActiveSubscriptions,
    int StaffMemberships,
    int AuditEvents
);

public sealed record PlatformTotals(
    int Organizations,
    int ContactRequests,
    int Tickets,
    int Meetings,
    int ActiveSubscriptions,
    int StaffMemberships,
    int Users,
    int PlatformAdmins,
    int CompletedContactRequests,
    double AverageDaysToServe,
    decimal TotalServiceValue,
    int OverdueServices
);

public sealed record PlatformAuditRow(
    long Id,
    string TenantId,
    string Action,
    string EntityType,
    string EntityId,
    Guid? ActorUserId,
    DateTimeOffset CreatedAt
);

public sealed record PlatformMembershipRow(string TenantId, string AccessLevel);

public sealed record PlatformUserRow(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string Status,
    DateTimeOffset? EmailVerifiedAt,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<string> Roles,
    IReadOnlyList<PlatformMembershipRow> Memberships
);
