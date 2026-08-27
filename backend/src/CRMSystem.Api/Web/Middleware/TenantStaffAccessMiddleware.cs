using System.Security.Claims;
using CRMSystem.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Api.Web.Middleware;

/// <summary>
/// Prevents a privileged account from using its global Identity role in a CRM centre to
/// which it has not been explicitly assigned. Client accounts remain global because a
/// single client must continue following a request after an inter-centre handover.
/// </summary>
public sealed class TenantStaffAccessMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, PortalDbContext db)
    {
        var principal = context.User;
        if (principal.Identity?.IsAuthenticated != true || !PortalRoles.TenantStaff.Any(principal.IsInRole))
        {
            await next(context);
            return;
        }

        if (principal.IsInRole(PortalRoles.PlatformAdmin))
        {
            await next(context);
            return;
        }

        var rawUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(rawUserId, out var userId)
            || !await db.UserTenantMemberships.AnyAsync(x => x.UserId == userId, context.RequestAborted))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(
                new { message = "The staff account is not assigned to this CRM centre." },
                context.RequestAborted);
            return;
        }

        await next(context);
    }
}
