using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;

namespace CRMSystem.Api.Web.Controllers.Identity;

[ApiController]
[Route("api/auth")]
public sealed partial class AuthController : ControllerBase
{
    private const string RefreshCookie = "crm-system.refresh";
    private readonly UserManager<AppUser> users;
    private readonly SignInManager<AppUser> signIn;
    private readonly ITokenService tokens;
    private readonly PortalDbContext db;
    private readonly IConfiguration config;
    private readonly IHostEnvironment env;

    public AuthController(
        UserManager<AppUser> users,
        SignInManager<AppUser> signIn,
        ITokenService tokens,
        PortalDbContext db,
        IConfiguration config,
        IHostEnvironment env)
    {
        this.users = users;
        this.signIn = signIn;
        this.tokens = tokens;
        this.db = db;
        this.config = config;
        this.env = env;
    }

    [HttpPost("register")]
    public async Task<IResult> Register(RegisterRequest request)
    {
        if (!request.TermsAccepted)
            return Results.BadRequest(new { message = "Terms acceptance is required." });
        if (
            request.TermsVersion != LegalDocumentVersions.Terms
            || request.PrivacyVersion != LegalDocumentVersions.Privacy
        )
            return Results.BadRequest(
                new
                {
                    message = "The legal documents changed. Reload the page and review the current versions.",
                }
            );
        var requestVerified = request.ContactRequestId is { } requestId
            && await db.ContactRequests.AnyAsync(item => item.Id == requestId && item.UserId == null
                && item.Email.ToLower() == request.Email.ToLower());
        var developmentVerified = env.IsDevelopment() || requestVerified;
        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName,
            LastName = request.LastName,
            PhoneNumber = request.Phone,
            PreferredLanguage = request.PreferredLanguage,
            TermsAcceptedAt = DateTimeOffset.UtcNow,
            EmailConfirmed = developmentVerified,
            EmailVerifiedAt = developmentVerified ? DateTimeOffset.UtcNow : null,
            Status = developmentVerified ? UserStatuses.Active : UserStatuses.PendingVerification,
        };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.ToArray();
            if (errors.Any(error => error.Code == nameof(IdentityErrorDescriber.DuplicateEmail)))
                errors = errors
                    .Where(error => error.Code != nameof(IdentityErrorDescriber.DuplicateUserName))
                    .ToArray();

            return Results.ValidationProblem(
                errors.ToDictionary(error => error.Code, error => new[] { error.Description })
            );
        }
        await users.AddToRoleAsync(user, "Client");
        db.UserTenantMemberships.Add(new UserTenantMembership
        {
            UserId = user.Id,
            AccessLevel = "Client",
        });
        var matchingRequests = await db.ContactRequests
            .Where(item => item.UserId == null && item.Email.ToLower() == request.Email.ToLower())
            .ToListAsync();
        foreach (var item in matchingRequests)
            item.UserId = user.Id;
        var organizationId = matchingRequests.Select(item => item.LinkedOrganizationId).FirstOrDefault(id => id is not null)
            ?? await db.Organizations.Where(organization => organization.Status == "Approved" && matchingRequests.Select(item => item.OrganizationName.ToLower()).Contains(organization.Name.ToLower()))
                .OrderBy(organization => organization.CreatedAt).Select(organization => (Guid?)organization.Id).FirstOrDefaultAsync();
        if (organizationId is { } resolvedOrganizationId)
        {
            user.OrganizationId = resolvedOrganizationId;
            foreach (var item in matchingRequests) item.LinkedOrganizationId ??= resolvedOrganizationId;
            if (!await db.OrganizationMembers.AnyAsync(member => member.OrganizationId == resolvedOrganizationId && member.UserId == user.Id))
                db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = resolvedOrganizationId, UserId = user.Id, MemberStatus = "Active", IsPrimaryContact = true });
        }
        db.AuditLogs.Add(
            new AuditLog
            {
                ActorUserId = user.Id,
                Action = "LegalConsentAccepted",
                EntityType = nameof(AppUser),
                EntityId = user.Id.ToString(),
                MetadataJson = JsonSerializer.Serialize(
                    new
                    {
                        termsVersion = request.TermsVersion,
                        privacyVersion = request.PrivacyVersion,
                        acceptedAt = user.TermsAcceptedAt,
                        language = request.PreferredLanguage,
                    }
                ),
            }
        );
        db.AuditLogs.Add(
            new AuditLog
            {
                ActorUserId = user.Id,
                Action = "UserRegistered",
                EntityType = nameof(AppUser),
                EntityId = user.Id.ToString(),
            }
        );
        if (!developmentVerified)
        {
            var token = Convert.ToBase64String(
                Encoding.UTF8.GetBytes(await users.GenerateEmailConfirmationTokenAsync(user))
            );
            var root = (config["APP_PUBLIC_URL"] ?? "http://localhost:5173").TrimEnd('/');
            var link =
                $"{root}/verify-email?userId={Uri.EscapeDataString(user.Id.ToString())}&token={Uri.EscapeDataString(token)}";
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = user.Id,
                    Type = "EmailVerification",
                    Subject = "Verify your CRM System account",
                    Body =
                        $"<p>Confirm your account:</p><p><a href=\"{WebUtility.HtmlEncode(link)}\">Verify email</a></p>",
                }
            );
        }
        await db.SaveChangesAsync();
        return Results.Ok(new { user.Id, message = "Verify your email." });
    }

    [HttpPost("login")]
    [HttpPost("session")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (
            user is null
            || user.Status != UserStatuses.Active
            || user.EmailVerifiedAt is null
            || !(await signIn.CheckPasswordSignInAsync(user, request.Password, true)).Succeeded
            || !user.EmailConfirmed
        )
        {
            db.AuditLogs.Add(
                new AuditLog
                {
                    ActorUserId = user?.Id,
                    Action = "LoginFailed",
                    EntityType = nameof(AppUser),
                    EntityId = user?.Id.ToString() ?? request.Email,
                }
            );
            await db.SaveChangesAsync();
            return Results.Unauthorized();
        }
        user.LastLoginAt = DateTimeOffset.UtcNow;
        db.AuditLogs.Add(
            new AuditLog
            {
                ActorUserId = user.Id,
                Action = "LoginSucceeded",
                EntityType = nameof(AppUser),
                EntityId = user.Id.ToString(),
            }
        );
        await db.SaveChangesAsync();
        var refresh = await tokens.CreateRefreshAsync(user);
        SetRefreshCookie(Response, refresh, env);
        return Results.Ok(
            new
            {
                accessToken = await tokens.CreateAsync(user),
                expiresIn = 1800,
                user = new
                {
                    user.Id,
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.OrganizationId,
                    user.Status,
                    user.EmailVerifiedAt,
                    user.MustChangePassword,
                    roles = await users.GetRolesAsync(user),
                },
            }
        );
    }

    [HttpPost("refresh")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshCookie, out var raw))
            return Results.Unauthorized();
        var pair = await tokens.RotateRefreshAsync(raw);
        if (pair is null)
            return Results.Unauthorized();
        SetRefreshCookie(Response, pair.Value.Refresh, env);
        return Results.Ok(
            new { accessToken = await tokens.CreateAsync(pair.Value.User), expiresIn = 1800 }
        );
    }

    [HttpPost("logout")]
    public async Task<IResult> Logout()
    {
        var principal = User;
        if (Request.Cookies.TryGetValue(RefreshCookie, out var raw))
            await tokens.RevokeAsync(raw);
        if (
            Guid.TryParse(
                principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
                out var userId
            )
        )
        {
            db.AuditLogs.Add(
                new AuditLog
                {
                    ActorUserId = userId,
                    Action = "Logout",
                    EntityType = nameof(AppUser),
                    EntityId = userId.ToString(),
                }
            );
            await db.SaveChangesAsync();
        }
        Response.Cookies.Delete(RefreshCookie);
        return Results.NoContent();
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IResult> Me()
    {
        var principal = User;
        return await users.GetUserAsync(principal) is { } user
            ? Results.Ok(
                new
                {
                    user.Id,
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.OrganizationId,
                    user.Status,
                    user.EmailVerifiedAt,
                    user.MustChangePassword,
                    roles = await users.GetRolesAsync(user),
                }
            )
            : Results.Unauthorized();
    }

}
