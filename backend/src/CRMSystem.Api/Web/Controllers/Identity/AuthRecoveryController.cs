using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;

namespace CRMSystem.Api.Web.Controllers.Identity;

public sealed partial class AuthController
{
    [HttpPost("verify-email")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> VerifyEmail(VerifyEmailRequest request)
    {
        var user = await users.FindByIdAsync(request.UserId);
        if (user is null || !TryDecodeToken(request.Token, out var token))
            return Results.BadRequest();
        var result = await users.ConfirmEmailAsync(user, token);
        if (result.Succeeded)
        {
            db.AuditLogs.Add(
                new AuditLog
                {
                    ActorUserId = user.Id,
                    Action = "EmailVerified",
                    EntityType = nameof(AppUser),
                    EntityId = user.Id.ToString(),
                }
            );
            await db.SaveChangesAsync();
            return Results.NoContent();
        }
        return Results.ValidationProblem(
            result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
        );
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> ForgotPassword(EmailRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is not null)
        {
            var token = Convert.ToBase64String(
                Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync(user))
            );
            var root = (config["APP_PUBLIC_URL"] ?? "http://localhost:5173").TrimEnd('/');
            var link =
                $"{root}/reset-password?email={Uri.EscapeDataString(request.Email)}&token={Uri.EscapeDataString(token)}";
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = user.Id,
                    Type = "PasswordReset",
                    Subject = "CRM System password reset",
                    Body =
                        $"<p>Reset your password:</p><p><a href=\"{WebUtility.HtmlEncode(link)}\">Set a new password</a></p>",
                }
            );
            db.AuditLogs.Add(
                new AuditLog
                {
                    ActorUserId = user.Id,
                    Action = "PasswordResetRequested",
                    EntityType = nameof(AppUser),
                    EntityId = user.Id.ToString(),
                }
            );
            await db.SaveChangesAsync();
        }
        return Results.NoContent();
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> ResetPassword(ResetPasswordRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is null || !TryDecodeToken(request.Token, out var token))
            return Results.BadRequest();
        var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (result.Succeeded)
        {
            user.MustChangePassword = false;
            user.LockoutEnabled = true;
            user.LockoutEnd = null;
            user.AccessFailedCount = 0;
            db.AuditLogs.Add(
                new AuditLog
                {
                    ActorUserId = user.Id,
                    Action = "PasswordResetCompleted",
                    EntityType = nameof(AppUser),
                    EntityId = user.Id.ToString(),
                }
            );
            await db.SaveChangesAsync();
            return Results.NoContent();
        }
        return Results.ValidationProblem(
            result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
        );
    }

    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
            return Results.Unauthorized();
        var result = await users.ChangePasswordAsync(
            user,
            request.CurrentPassword,
            request.NewPassword
        );
        if (!result.Succeeded)
            return Results.ValidationProblem(
                result.Errors.ToDictionary(error => error.Code, error => new[] { error.Description })
            );

        user.MustChangePassword = false;
        user.LockoutEnabled = true;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;
        db.AuditLogs.Add(
            new AuditLog
            {
                ActorUserId = user.Id,
                Action = "TemporaryPasswordChanged",
                EntityType = nameof(AppUser),
                EntityId = user.Id.ToString(),
            }
        );
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static bool TryDecodeToken(string token, out string value)
    {
        try
        {
            value = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            return true;
        }
        catch (FormatException)
        {
            value = "";
            return false;
        }
    }

    private void SetRefreshCookie(HttpResponse response, string token, IHostEnvironment env) =>
        response.Cookies.Append(
            RefreshCookie,
            token,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = !env.IsDevelopment(),
                SameSite = config.GetValue<bool>("Auth:CrossSiteCookies")
                    ? SameSiteMode.None
                    : SameSiteMode.Strict,
                Expires = DateTimeOffset.UtcNow.AddDays(14),
                Path = "/api/auth",
            }
        );
}
