using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;

namespace CRMSystem.Api.Web.Middleware;

/// <summary>
/// Re-checks the persisted account state and roles after JWT validation so an administrator can
/// revoke an already issued access token immediately by deactivating the account or changing roles.
/// </summary>
public sealed class ActiveUserMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, PortalDbContext db)
    {
        if (
            context.User.Identity?.IsAuthenticated == true
            && TryGetUserId(context.User, out var userId)
        )
        {
            var state = await db
                .Users.AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => new
                {
                    user.Status,
                    user.EmailConfirmed,
                    user.EmailVerifiedAt,
                    user.AssignedBrand,
                    user.AssignedPartnerCode,
                })
                .SingleOrDefaultAsync(context.RequestAborted);

            if (
                state is null
                || state.Status != UserStatuses.Active
                || !state.EmailConfirmed
                || state.EmailVerifiedAt is null
            )
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new { message = "This account is inactive or no longer verified." },
                    context.RequestAborted
                );
                return;
            }

            var persistedRoles = await db
                .UserRoles.Where(userRole => userRole.UserId == userId)
                .Join(
                    db.Roles,
                    userRole => userRole.RoleId,
                    role => role.Id,
                    (_, role) => role.Name!
                )
                .ToListAsync(context.RequestAborted);
            var tokenRoles = context
                .User.FindAll(ClaimTypes.Role)
                .Select(claim => claim.Value)
                .ToHashSet(StringComparer.Ordinal);
            if (!tokenRoles.SetEquals(persistedRoles))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new { message = "Account permissions changed. Please sign in again." },
                    context.RequestAborted
                );
                return;
            }

            // Scope is deliberately refreshed from the database on every request. This means
            // changing an account from Global -> BAU (or assigning a partner) takes effect
            // immediately without waiting for the old JWT to expire.
            var scopeClaims = context.User.Identities.FirstOrDefault();
            if (scopeClaims is not null)
            {
                foreach (var claim in scopeClaims.FindAll("crm:assigned-brand").ToArray())
                    scopeClaims.RemoveClaim(claim);
                foreach (var claim in scopeClaims.FindAll("crm:assigned-partner").ToArray())
                    scopeClaims.RemoveClaim(claim);
                foreach (var claim in scopeClaims.FindAll("crm:global-scope").ToArray())
                    scopeClaims.RemoveClaim(claim);

                if (!string.IsNullOrWhiteSpace(state.AssignedBrand))
                    scopeClaims.AddClaim(new Claim("crm:assigned-brand", state.AssignedBrand.Trim().ToLowerInvariant()));
                if (!string.IsNullOrWhiteSpace(state.AssignedPartnerCode))
                    scopeClaims.AddClaim(new Claim("crm:assigned-partner", state.AssignedPartnerCode.Trim().ToLowerInvariant()));
                var global = persistedRoles.Contains(PortalRoles.PlatformAdmin, StringComparer.OrdinalIgnoreCase)
                    || (persistedRoles.Contains(PortalRoles.Admin, StringComparer.OrdinalIgnoreCase)
                        && string.IsNullOrWhiteSpace(state.AssignedBrand));
                if (global)
                    scopeClaims.AddClaim(new Claim("crm:global-scope", "true"));
            }
        }

        await next(context);
    }

    internal static bool TryGetUserId(ClaimsPrincipal principal, out Guid userId) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
