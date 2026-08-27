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
    [HttpGet("roles")]
    public async Task<IReadOnlyList<string>> GetRoles(CancellationToken ct)
    {
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
    public async Task<IResult> CreateUser(CreateUserRequest request)
    {
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
        };
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
                user.CreatedAt,
                user.UpdatedAt,
                Roles = new[] { role },
            }
        );
    }
    [HttpGet]
    public async Task<object> Get(CancellationToken ct)
    {
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
            item.CreatedAt,
            item.UpdatedAt,
            Roles = roleRows
                .Where(role => role.UserId == item.Id)
                .Select(role => role.Role)
                .OrderBy(role => role)
                .ToArray(),
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IResult> GetOne(Guid id) =>
        await FindTenantUserAsync(id) is { } user
            ? Results.Ok(
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
                    user.CreatedAt,
                    user.UpdatedAt,
                    roles = await users.GetRolesAsync(user),
                }
            )
            : Results.NotFound();

    [HttpPatch("{id:guid}")]
    public async Task<IResult> Update(Guid id, UserUpdateRequest request)
    {
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
