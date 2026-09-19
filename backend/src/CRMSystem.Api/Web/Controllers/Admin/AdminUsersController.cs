using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = "Admin")]
public sealed class AdminUsersController(
    PortalDbContext db,
    UserManager<AppUser> users,
    RoleManager<IdentityRole<Guid>> roles,
    ITemporaryPasswordGenerator passwords,
    IConfiguration config
)
    : ControllerBase
{
    private bool CanManageScopedUsers => User.IsInRole(PortalRoles.PlatformAdmin)
        || (User.IsInRole(PortalRoles.Admin) && string.IsNullOrWhiteSpace(User.FindFirst("crm:assigned-brand")?.Value));

    private static readonly string[] KnownBrands = ["digitmak", "bau", "vezilka", "hpc"];

    [HttpGet("roles")]
    public async Task<IReadOnlyList<string>> GetRoles(CancellationToken ct)
    {
        if (!CanManageScopedUsers) return [];
        var canManagePlatformRoles = User.IsInRole(PortalRoles.PlatformAdmin);
        return await db.Roles
            .Where(role => role.Name != null)
            .Where(role => role.Name != PortalRoles.PlatformAdmin || canManagePlatformRoles)
            .OrderBy(role => role.Name)
            .Select(role => role.Name!)
            .ToListAsync(ct);
    }

    [HttpPost("roles")]
    public async Task<IResult> CreateRole(CreateRoleRequest request)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var name = request.Name.Trim();
        if (name.Length < 2 || name.Length > 40 || name.Any(ch => !char.IsLetterOrDigit(ch) && ch is not ' ' and not '-' and not '_'))
            return Results.BadRequest(new { message = "Role name must be 2-40 letters, numbers, spaces, - or _." });
        if (IsPlatformRole(name) && !User.IsInRole(PortalRoles.PlatformAdmin))
            return Results.Forbid();
        if (await roles.RoleExistsAsync(name)) return Results.Conflict(new { message = "Role already exists." });
        var result = await roles.CreateAsync(new IdentityRole<Guid>(name));
        return result.Succeeded
            ? Results.Created($"/api/admin/users/roles/{Uri.EscapeDataString(name)}", new { name })
            : Results.ValidationProblem(
                result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
            );
    }

    [HttpPost]
    public async Task<IResult> CreateUser(CreateUserRequest request, CancellationToken ct)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var firstName = request.FirstName.Trim();
        var lastName = request.LastName.Trim();
        var email = request.Email.Trim();
        var role = request.Role.Trim();
        if (firstName.Length == 0 || lastName.Length == 0 || email.Length == 0)
            return Results.BadRequest(new { message = "First name, last name and email are required." });
        if (IsPlatformRole(role) && !User.IsInRole(PortalRoles.PlatformAdmin))
            return Results.Forbid();
        if (!await roles.RoleExistsAsync(role))
            return Results.BadRequest(new { message = $"Unknown role {role}." });

        var requestedBrand = NormalizeBrand(request.AssignedBrand);
        if (role.Equals(PortalRoles.Admin, StringComparison.OrdinalIgnoreCase) && requestedBrand is null)
        {
            var globalAdminCount = await db.UserRoles
                .Join(db.Roles.Where(r => r.Name == PortalRoles.Admin), ur => ur.RoleId, r => r.Id, (ur, r) => ur.UserId)
                .Join(db.Users, id => id, user => user.Id, (id, user) => user)
                .CountAsync(user => user.AssignedBrand == null
                    && !db.UserRoles.Any(ur => ur.UserId == user.Id
                        && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == PortalRoles.PlatformAdmin)), ct);
            if (globalAdminCount >= 4)
                return Results.Conflict(new { message = "There are already 4 Global Admin accounts. Assign a brand to an existing admin or use PlatformAdmin." });
        }

        var now = DateTimeOffset.UtcNow;
        var user = new AppUser
        {
            UserName = email,
            Email = email,
            FirstName = firstName,
            LastName = lastName,
            PhoneNumber = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            PreferredLanguage = request.PreferredLanguage is "en" or "sq" ? request.PreferredLanguage : "mk",
            EmailConfirmed = true,
            EmailVerifiedAt = now,
            Status = UserStatuses.Active,
            MustChangePassword = false,
            LockoutEnabled = false,
            AssignedBrand = requestedBrand,
            AssignedPartnerCode = NormalizePartner(request.AssignedPartnerCode),
        };
        if (user.AssignedBrand is null && !string.IsNullOrWhiteSpace(request.AssignedPartnerCode))
            return Results.BadRequest(new { message = "Select a brand before assigning a partner." });
        if (user.AssignedBrand is not null && user.AssignedPartnerCode is not null
            && !await db.AffiliatePartners.AnyAsync(p => p.BrandCode == user.AssignedBrand && p.PartnerCode == user.AssignedPartnerCode && p.IsActive, ct))
            return Results.BadRequest(new { message = "The selected partner does not belong to the selected brand." });
        var temporaryPassword = passwords.Generate();
        var created = await users.CreateAsync(user, temporaryPassword);
        if (!created.Succeeded)
        {
            var errors = created.Errors.ToArray();
            if (errors.Any(error => error.Code == nameof(IdentityErrorDescriber.DuplicateEmail)))
                errors = errors.Where(error => error.Code != nameof(IdentityErrorDescriber.DuplicateUserName)).ToArray();
            return Results.ValidationProblem(
                errors.ToDictionary(error => error.Code, error => new[] { error.Description })
            );
        }

        await users.AddToRoleAsync(user, role);
        db.UserTenantMemberships.Add(new UserTenantMembership
        {
            UserId = user.Id,
            AccessLevel = role,
            TenantId = user.AssignedBrand ?? db.WriteTenantId,
        });
        var publicUrl = config["APP_PUBLIC_URL"] ?? "http://localhost:5173";
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var activationUrl = $"{publicUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
        db.Notifications.Add(AdminUserWelcomeEmail.Create(user, activationUrl));
        db.AuditLogs.Add(Audit(User, "UserCreated", nameof(AppUser), user.Id, null, role));
        await db.SaveChangesAsync();
        return Results.Created(
            $"/api/admin/users/{user.Id}",
            new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                user.PhoneNumber,
                user.PreferredLanguage,
                user.Status,
                user.EmailVerifiedAt,
                user.OrganizationId,
                user.AssignedBrand,
                user.AssignedPartnerCode,
                user.CreatedAt,
                user.UpdatedAt,
                Roles = new[] { role },
            }
        );
    }
    [HttpGet]
    public async Task<object> Get(CancellationToken ct)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var tenantUserIds = db.UserTenantMemberships.Select(item => item.UserId);
        var items = await db
            .Users.Where(user => tenantUserIds.Contains(user.Id)).Select(x => new
            {
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                x.PhoneNumber,
                x.PreferredLanguage,
                x.Status,
                x.EmailVerifiedAt,
                x.OrganizationId,
                x.AssignedBrand,
                x.AssignedPartnerCode,
                x.CreatedAt,
                x.UpdatedAt,
            })
            .ToListAsync(ct);
        var roleRows = await db
            .UserRoles.Join(
                db.Roles,
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, role) => new { userRole.UserId, Role = role.Name! }
            )
            .ToListAsync(ct);
        return items.Select(item => new
        {
            item.Id,
            item.Email,
            item.FirstName,
            item.LastName,
            item.PhoneNumber,
            item.PreferredLanguage,
            item.Status,
            item.EmailVerifiedAt,
            item.OrganizationId,
            item.AssignedBrand,
            item.AssignedPartnerCode,
            item.CreatedAt,
            item.UpdatedAt,
            Roles = roleRows
                .Where(role => role.UserId == item.Id)
                .Select(role => role.Role)
                .OrderBy(role => role)
                .ToArray(),
        });
    }

    public sealed record SetAssignedBrandRequest(string? AssignedBrand);
    public sealed record SetAssignedPartnerRequest(string? PartnerCode);

    [HttpPut("{id:guid}/assigned-brand")]
    public async Task<IResult> SetAssignedBrand(Guid id, SetAssignedBrandRequest request, CancellationToken ct)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return Results.NotFound();
        if (await users.IsInRoleAsync(user, PortalRoles.PlatformAdmin))
            return Results.BadRequest(new { message = "PlatformAdmin is always unrestricted." });
        var brand = NormalizeBrand(request.AssignedBrand);
        if (brand is not null && !KnownBrands.Contains(brand, StringComparer.OrdinalIgnoreCase))
            return Results.BadRequest(new { message = "Unknown brand. Use digitmak, bau, vezilka or hpc." });
        if (brand is null && await users.IsInRoleAsync(user, PortalRoles.Admin))
        {
            var globalAdminCount = await db.UserRoles
                .Join(db.Roles.Where(r => r.Name == PortalRoles.Admin), ur => ur.RoleId, r => r.Id, (ur, r) => ur.UserId)
                .Join(db.Users, id => id, u => u.Id, (id, u) => u)
                .CountAsync(u => u.AssignedBrand == null
                    && !db.UserRoles.Any(ur => ur.UserId == u.Id
                        && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == PortalRoles.PlatformAdmin)), ct);
            if (globalAdminCount >= 4 && !string.IsNullOrWhiteSpace(user.AssignedBrand))
                return Results.Conflict(new { message = "There are already 4 Global Admin accounts." });
        }
        user.AssignedBrand = brand;
        var membership = await db.UserTenantMemberships
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.UserId == user.Id, ct);
        if (membership is not null)
            membership.TenantId = brand ?? db.WriteTenantId;
        if (brand is null) user.AssignedPartnerCode = null;
        else if (user.AssignedPartnerCode is not null
            && !await db.AffiliatePartners.AnyAsync(p => p.BrandCode == brand && p.PartnerCode == user.AssignedPartnerCode && p.IsActive, ct))
            user.AssignedPartnerCode = null;
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { user.AssignedBrand, user.AssignedPartnerCode });
    }

    [HttpPut("{id:guid}/assigned-partner")]
    public async Task<IResult> SetAssignedPartner(Guid id, SetAssignedPartnerRequest request, CancellationToken ct)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return Results.NotFound();
        if (await users.IsInRoleAsync(user, PortalRoles.PlatformAdmin))
            return Results.BadRequest(new { message = "PlatformAdmin is always unrestricted." });
        var partner = NormalizePartner(request.PartnerCode);
        if (partner is null) { user.AssignedPartnerCode = null; await db.SaveChangesAsync(ct); return Results.Ok(); }
        if (string.IsNullOrWhiteSpace(user.AssignedBrand))
            return Results.BadRequest(new { message = "Assign a brand before assigning a partner." });
        if (!await db.AffiliatePartners.AnyAsync(p => p.BrandCode == user.AssignedBrand && p.PartnerCode == partner && p.IsActive, ct))
            return Results.BadRequest(new { message = "The selected partner does not belong to the user's brand." });
        user.AssignedPartnerCode = partner;
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { user.AssignedBrand, user.AssignedPartnerCode });
    }

    private static string? NormalizeBrand(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

    private static string? NormalizePartner(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

    [HttpGet("{id:guid}")]
    public async Task<IResult> GetOne(Guid id)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var user = await FindTenantUserAsync(id);
        if (user is null) return Results.NotFound();
        return Results.Ok(new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.PhoneNumber,
            user.PreferredLanguage,
            user.Status,
            user.EmailVerifiedAt,
            user.OrganizationId,
            user.AssignedBrand,
            user.AssignedPartnerCode,
            user.CreatedAt,
            user.UpdatedAt,
            roles = await users.GetRolesAsync(user),
        });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IResult> Update(Guid id, UserUpdateRequest request)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var principal = User;
        var user = await FindTenantUserAsync(id);
        if (user is null)
            return Results.NotFound();
        var previousStatus = user.Status;
        var nextStatus = request.Status;
        if (!UserStatuses.IsValid(nextStatus))
            return Results.BadRequest(new { message = "Unsupported user status." });
        user.Status = nextStatus;
        user.PreferredLanguage = request.PreferredLanguage;
        user.PhoneNumber = request.Phone;
        if (previousStatus == UserStatuses.Active && nextStatus != UserStatuses.Active)
        {
            var now = DateTimeOffset.UtcNow;
            var tokens = await db
                .RefreshTokens.Where(token => token.UserId == id && token.RevokedAt == null)
                .ToListAsync();
            foreach (var token in tokens)
                token.RevokedAt = now;
            user.SecurityStamp = Guid.NewGuid().ToString();
        }
        db.AuditLogs.Add(
            Audit(principal, "UserStatusChanged", nameof(AppUser), id, previousStatus, nextStatus)
        );
        await db.SaveChangesAsync();
        return Results.Ok(user);
    }

    [HttpPost("{id:guid}/roles")]
    public async Task<IResult> AddRoles(Guid id, RolesRequest request, CancellationToken ct)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var principal = User;
        var user = await FindTenantUserAsync(id);
        if (user is null)
            return Results.NotFound();
        var requestedRoles = request.Roles
            .Select(role => role.Trim())
            .Where(role => role.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (requestedRoles.Length == 0)
            return Results.BadRequest(new { message = "Choose at least one role." });
        foreach (var role in requestedRoles)
        {
            if (IsPlatformRole(role) && !User.IsInRole(PortalRoles.PlatformAdmin))
                return Results.Forbid();
            if (!await roles.RoleExistsAsync(role))
                return Results.BadRequest(new { message = $"Unknown role {role}." });
            if (role.Equals(PortalRoles.Admin, StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrWhiteSpace(user.AssignedBrand)
                && !await users.IsInRoleAsync(user, PortalRoles.Admin))
            {
                var globalAdminCount = await db.UserRoles
                    .Join(db.Roles.Where(r => r.Name == PortalRoles.Admin), ur => ur.RoleId, r => r.Id, (ur, r) => ur.UserId)
                    .Join(db.Users, id => id, u => u.Id, (id, u) => u)
                    .CountAsync(u => u.AssignedBrand == null
                        && !db.UserRoles.Any(ur => ur.UserId == u.Id
                            && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == PortalRoles.PlatformAdmin)), ct);
                if (globalAdminCount >= 4)
                    return Results.Conflict(new { message = "There are already 4 Global Admin accounts." });
            }
            if (!await users.IsInRoleAsync(user, role))
            {
                var result = await users.AddToRoleAsync(user, role);
                if (!result.Succeeded)
                    return Results.ValidationProblem(
                        result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
                    );
            }
        }
        await EnsureTenantMembershipAsync(user.Id, requestedRoles, ct);
        db.AuditLogs.Add(
            Audit(
                principal,
                "RoleAdded",
                nameof(AppUser),
                id,
                null,
                JsonSerializer.Serialize(requestedRoles)
            )
        );
        await db.SaveChangesAsync(ct);
        return Results.Ok(await users.GetRolesAsync(user));
    }

    [HttpDelete("{id:guid}/roles/{role}")]
    public async Task<IResult> RemoveRole(Guid id, string role)
    {
        if (!CanManageScopedUsers) return Results.Forbid();
        var principal = User;
        var user = await FindTenantUserAsync(id);
        if (user is null)
            return Results.NotFound();
        if (IsPlatformRole(role) && !User.IsInRole(PortalRoles.PlatformAdmin))
            return Results.Forbid();
        var result = await users.RemoveFromRoleAsync(user, role);
        if (!result.Succeeded)
            return Results.ValidationProblem(
                result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
            );
        await RefreshTenantMembershipAccessAsync(user.Id);
        db.AuditLogs.Add(Audit(principal, "RoleRemoved", nameof(AppUser), id, role));
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private async Task<AppUser?> FindTenantUserAsync(Guid id)
    {
        var allowed = await db.UserTenantMemberships.AnyAsync(item => item.UserId == id);
        return allowed ? await users.FindByIdAsync(id.ToString()) : null;
    }

    private async Task EnsureTenantMembershipAsync(Guid userId, IReadOnlyCollection<string> requestedRoles, CancellationToken ct)
    {
        var membership = await db.UserTenantMemberships
            .SingleOrDefaultAsync(item => item.UserId == userId, ct);
        var accessLevel = HighestAccessLevel(requestedRoles);
        if (membership is null)
        {
            db.UserTenantMemberships.Add(new UserTenantMembership
            {
                UserId = userId,
                AccessLevel = accessLevel,
            });
            return;
        }

        if (RolePriority(accessLevel) > RolePriority(membership.AccessLevel))
            membership.AccessLevel = accessLevel;
    }

    private async Task RefreshTenantMembershipAccessAsync(Guid userId)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
            return;
        var remainingRoles = await users.GetRolesAsync(user);
        var membership = await db.UserTenantMemberships.SingleOrDefaultAsync(item => item.UserId == userId);
        if (membership is not null)
            membership.AccessLevel = remainingRoles.Count == 0 ? "Client" : HighestAccessLevel(remainingRoles);
    }

    private static string HighestAccessLevel(IEnumerable<string> roleNames) =>
        roleNames
            .DefaultIfEmpty("Client")
            .OrderByDescending(RolePriority)
            .First();

    private static int RolePriority(string role) =>
        role switch
        {
            "PlatformAdmin" => 50,
            "Admin" => 40,
            "HelpDeskAgent" => 30,
            "Expert" => 20,
            "Client" => 10,
            _ => 5,
        };

    private static bool IsPlatformRole(string role) =>
        string.Equals(role, PortalRoles.PlatformAdmin, StringComparison.OrdinalIgnoreCase);
}
