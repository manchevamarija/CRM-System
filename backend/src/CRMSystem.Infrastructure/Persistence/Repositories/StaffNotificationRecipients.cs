using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Infrastructure.Persistence.Repositories;

public static class StaffNotificationRecipients
{
    public const string RolesSettingKey = "StaffNotificationRoles";

    public static async Task<IReadOnlyList<Guid>> GetAsync(
        PortalDbContext db,
        CancellationToken cancellationToken = default,
        string? brandCode = null
    )
    {
        var roles = await EnabledRolesAsync(db, cancellationToken, brandCode);
        var rows = await db.UserRoles
            .IgnoreQueryFilters()
            .Join(
                db.Roles,
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, role) => new { userRole.UserId, Role = role.Name! }
            )
            .Join(
                db.Users,
                row => row.UserId,
                user => user.Id,
                (row, user) => new { row.UserId, row.Role, user.AssignedBrand }
            )
            .Where(x => roles.Contains(x.Role) || x.Role == PortalRoles.PlatformAdmin)
            .Where(x =>
                x.Role == PortalRoles.PlatformAdmin
                || (brandCode == null
                    ? x.AssignedBrand == null
                    : x.AssignedBrand == brandCode
                        || (x.Role == PortalRoles.Admin && x.AssignedBrand == null)))
            .Select(x => x.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
        return rows;
    }

    public static async Task<IReadOnlyList<string>> EnabledRolesAsync(
        PortalDbContext db,
        CancellationToken cancellationToken = default,
        string? brandCode = null
    )
    {
        var settings = db.SystemSettings.IgnoreQueryFilters();
        if (!string.IsNullOrWhiteSpace(brandCode))
            settings = settings.Where(setting => setting.TenantId == brandCode);
        var configured = await settings
            .Where(setting => setting.Key == RolesSettingKey)
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
