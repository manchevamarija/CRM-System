using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Infrastructure.Persistence.Repositories;

public static class StaffNotificationRecipients
{
    public const string RolesSettingKey = "StaffNotificationRoles";

    public static async Task<IReadOnlyList<Guid>> GetAsync(
        PortalDbContext db,
        CancellationToken cancellationToken = default
    )
    {
        var roles = await EnabledRolesAsync(db, cancellationToken);
        var tenantMemberIds = db.UserTenantMemberships.Select(membership => membership.UserId);
        var membershipStaff = db
            .UserTenantMemberships.Where(membership => roles.Contains(membership.AccessLevel))
            .Select(membership => membership.UserId);
        var roleStaff = db
            .UserRoles.Join(
                db.Roles.Where(role => role.Name != null && roles.Contains(role.Name)),
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, _) => userRole.UserId
            )
            .Where(userId => tenantMemberIds.Contains(userId));

        return await membershipStaff.Union(roleStaff).ToListAsync(cancellationToken);
    }

    public static async Task<IReadOnlyList<string>> EnabledRolesAsync(
        PortalDbContext db,
        CancellationToken cancellationToken = default
    )
    {
        var configured = await db
            .SystemSettings.Where(setting => setting.Key == RolesSettingKey)
            .Select(setting => setting.Value)
            .SingleOrDefaultAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(configured))
            return PortalRoles.TenantStaff;

        var allowed = PortalRoles.TenantStaff.ToHashSet(StringComparer.Ordinal);
        var roles = configured
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(allowed.Contains)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return roles.Length == 0 ? PortalRoles.TenantStaff : roles;
    }
}
