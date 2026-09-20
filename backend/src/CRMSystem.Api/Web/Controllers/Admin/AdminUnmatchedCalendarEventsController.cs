using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application.Tenancy;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

/// <summary>Resolve an unmatched event either against an existing organization/contact,
/// or by creating a brand-new client (and, if needed, a brand-new organization) for them —
/// exactly the same account-creation path an admin would use from the Users screen
/// (temporary password, activation email), just triggered from this queue instead.</summary>
public record ResolveUnmatchedCalendarEventRequest(
    Guid? OrganizationId,
    Guid? RequestedByUserId,
    string? NewOrganizationName,
    string? NewContactFirstName,
    string? NewContactLastName,
    string? NewContactEmail);

[ApiController]
[Authorize(Policy = "Admin")]
[Route("api/admin/calendar/unmatched-events")]
public sealed class AdminUnmatchedCalendarEventsController(
    PortalDbContext db,
    UserManager<AppUser> users,
    ITemporaryPasswordGenerator passwords,
    IConfiguration config,
    ITenantContext tenantContext) : ControllerBase
{
    [HttpGet]
    public async Task<IResult> List(CancellationToken ct)
    {
        var items = await db.UnmatchedCalendarEvents
            .Where(x => x.Status == "Pending")
            .OrderBy(x => x.StartsAt)
            .Join(db.CalendarConnections, e => e.CalendarConnectionId, c => c.Id, (e, c) => new
            {
                e.Id,
                e.Subject,
                e.AttendeeEmail,
                e.StartsAt,
                e.EndsAt,
                connectionOwnerUserId = c.UserId,
                connectionProvider = c.Provider,
            })
            .ToListAsync(ct);
        return Results.Ok(items);
    }

    [HttpPost("{id:guid}/resolve")]
    public async Task<IResult> Resolve(Guid id, ResolveUnmatchedCalendarEventRequest request, CancellationToken ct)
    {
        var item = await db.UnmatchedCalendarEvents.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null)
            return Results.NotFound();
        var connection = await db.CalendarConnections.FirstOrDefaultAsync(x => x.Id == item.CalendarConnectionId, ct);
        if (connection is null)
            return Results.BadRequest(new { message = "The originating calendar connection no longer exists." });

        Guid organizationId;
        Guid requestedByUserId;

        var creatingNewClient = request.OrganizationId is null && request.RequestedByUserId is null;
        if (creatingNewClient)
        {
            if (string.IsNullOrWhiteSpace(request.NewOrganizationName)
                || string.IsNullOrWhiteSpace(request.NewContactFirstName)
                || string.IsNullOrWhiteSpace(request.NewContactLastName)
                || string.IsNullOrWhiteSpace(request.NewContactEmail))
                return Results.BadRequest(new { message = "Organization name, contact name and email are required for a new client." });

            var email = request.NewContactEmail.Trim();
            var newUser = new AppUser
            {
                UserName = email,
                Email = email,
                FirstName = request.NewContactFirstName.Trim(),
                LastName = request.NewContactLastName.Trim(),
                PreferredLanguage = "mk",
                EmailConfirmed = true,
                EmailVerifiedAt = DateTimeOffset.UtcNow,
                Status = UserStatuses.Active,
                MustChangePassword = false,
                LockoutEnabled = false,
            };
            var created = await users.CreateAsync(newUser, passwords.Generate());
            if (!created.Succeeded)
            {
                var errors = created.Errors.ToArray();
                if (errors.Any(error => error.Code == nameof(IdentityErrorDescriber.DuplicateEmail)))
                    errors = errors.Where(error => error.Code != nameof(IdentityErrorDescriber.DuplicateUserName)).ToArray();
                return Results.ValidationProblem(errors.ToDictionary(error => error.Code, error => new[] { error.Description }));
            }
            await users.AddToRoleAsync(newUser, PortalRoles.Client);

            var newOrganization = new Organization
            {
                Name = request.NewOrganizationName.Trim(),
                Type = "Other",
                Status = "Approved",
                CreatedByUserId = User.UserId(),
                ApprovedBy = User.UserId(),
                ApprovedAt = DateTimeOffset.UtcNow,
            };
            db.Organizations.Add(newOrganization);
            newUser.OrganizationId = newOrganization.Id;
            db.OrganizationMembers.Add(new OrganizationMember
            {
                OrganizationId = newOrganization.Id,
                UserId = newUser.Id,
                IsPrimaryContact = true,
                MemberStatus = "Active",
            });

            var publicUrl = config["APP_PUBLIC_URL"] ?? "http://localhost:5173";
            var token = await users.GeneratePasswordResetTokenAsync(newUser);
            var activationUrl = $"{publicUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
            db.Notifications.Add(AdminUserWelcomeEmail.Create(newUser, activationUrl, tenantContext.Current.Name));
            db.AuditLogs.Add(Audit(User, "UserCreatedFromCalendarEvent", nameof(AppUser), newUser.Id));

            organizationId = newOrganization.Id;
            requestedByUserId = newUser.Id;
        }
        else
        {
            if (request.OrganizationId is null || request.RequestedByUserId is null)
                return Results.BadRequest(new { message = "Both organization and contact are required." });
            organizationId = request.OrganizationId.Value;
            requestedByUserId = request.RequestedByUserId.Value;
        }

        db.Meetings.Add(new Meeting
        {
            OrganizationId = organizationId,
            RequestedByUserId = requestedByUserId,
            AssignedUserId = connection.UserId,
            Subject = item.Subject,
            Description = "",
            MeetingType = "Online",
            StartsAt = item.StartsAt,
            EndsAt = item.EndsAt,
            Status = "Confirmed",
            ConfirmedAt = DateTimeOffset.UtcNow,
            ExternalEventId = item.ExternalEventId,
            ExternalCalendarProvider = connection.Provider,
        });
        item.Status = "Resolved";
        item.ResolvedOrganizationId = organizationId;
        await db.SaveChangesAsync(ct);
        return Results.Ok();
    }

    [HttpPost("{id:guid}/ignore")]
    public async Task<IResult> Ignore(Guid id, CancellationToken ct)
    {
        var item = await db.UnmatchedCalendarEvents.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null)
            return Results.NotFound();
        item.Status = "Ignored";
        await db.SaveChangesAsync(ct);
        return Results.Ok();
    }
}
