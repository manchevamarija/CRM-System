using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Infrastructure.Persistence;

public static partial class DatabaseInitializer
{
    public static async Task InitializePortalAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
        if (
            db.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true
        )
            await db.Database.MigrateAsync();
        else
        {
            await db.Database.EnsureCreatedAsync();
            await EnsureLocalSchemaAsync(db);
        }
        var environment = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in new[] { "Admin", "HelpDeskAgent", "Expert", "Client" })
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole<Guid>(role));
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var temporaryPasswordUsers = await db.Users
            .Where(user => user.MustChangePassword)
            .ToListAsync();
        foreach (var temporaryUser in temporaryPasswordUsers)
        {
            temporaryUser.LockoutEnabled = false;
            temporaryUser.LockoutEnd = null;
            temporaryUser.AccessFailedCount = 0;
        }
        if (temporaryPasswordUsers.Count > 0)
            await db.SaveChangesAsync();
        var bootstrapEmail =
            Environment.GetEnvironmentVariable("ADMIN_BOOTSTRAP_EMAIL") ?? "admin@crmsystem.mk";
        var bootstrapPassword =
            Environment.GetEnvironmentVariable("ADMIN_BOOTSTRAP_PASSWORD")
            ?? "CRMSystem!2026Admin";
        var resetDevelopmentPassword =
            environment.IsDevelopment()
            && configuration.GetValue<bool>("BootstrapAdmin:ResetPasswordOnStartup");
        var admin = await EnsureBootstrapAdminAsync(
            users,
            bootstrapEmail,
            bootstrapPassword,
            resetDevelopmentPassword
        );

        if (configuration.GetValue<bool>("DemoAccount:Enabled") || environment.IsDevelopment())
            await EnsureDemoClientAsync(users, db, admin, configuration);

        // One-time legacy backfill. Future accounts receive an explicit membership when they
        // are created, while the same global user identity can hold memberships in many centres.
        if (!await db.UserTenantMemberships.IgnoreQueryFilters().AnyAsync())
        {
            var legacyUserIds = await db.Users.Select(user => user.Id).ToListAsync();
            db.UserTenantMemberships.AddRange(
                legacyUserIds.Select(userId => new UserTenantMembership { UserId = userId }));
        }
        else if (!await db.UserTenantMemberships.AnyAsync(item => item.UserId == admin.Id))
        {
            db.UserTenantMemberships.Add(new UserTenantMembership
            {
                UserId = admin.Id,
                AccessLevel = "Admin",
            });
        }
        var currentTenantMemberIds = (await db.UserTenantMemberships
            .Select(item => item.UserId)
            .ToListAsync()).ToHashSet();
        foreach (var pendingMembership in db.UserTenantMemberships.Local)
            currentTenantMemberIds.Add(pendingMembership.UserId);
        var activeUserIds = await db.Users
            .Where(user => user.Status == UserStatuses.Active)
            .Select(user => user.Id)
            .ToListAsync();
        foreach (var userId in activeUserIds.Where(userId => currentTenantMemberIds.Add(userId)))
        {
            var user = await users.FindByIdAsync(userId.ToString());
            if (user is null)
                continue;
            db.UserTenantMemberships.Add(new UserTenantMembership
            {
                UserId = userId,
                AccessLevel = HighestAccessLevel(await users.GetRolesAsync(user)),
            });
        }
        if (!await db.SystemSettings.AnyAsync(x => x.Key == "DataRetentionDays"))
            db.SystemSettings.Add(
                new SystemSetting
                {
                    Key = "DataRetentionDays",
                    Value = "730",
                    Description = "Retention for operational notifications and temporary records.",
                }
            );
        var evidenceTemplates = new[]
        {
            Template(
                "TICKET-RESOLUTION",
                "Ticket resolution evidence",
                "Ticket",
                "Evidence of delivered help-desk guidance and resolution.",
                "ticketNumber",
                "category",
                "finalRecommendation",
                "resolvedAt"
            ),
            Template(
                "MEETING-DELIVERY",
                "Meeting delivery evidence",
                "Meeting",
                "Evidence of a confirmed or completed consultation.",
                "subject",
                "meetingType",
                "startsAt",
                "attendees",
                "outcome"
            ),
            Template(
                "SUBSCRIPTION-KPI",
                "Subscription KPI evidence",
                "Subscription",
                "Evidence for an active annual personal subscription.",
                "userId",
                "organizationId",
                "startsAt",
                "expiresAt",
                "paymentReference"
            ),
            Template(
                "CONTACT-INTAKE",
                "Contact request evidence",
                "ContactRequest",
                "Evidence of public DMA-style intake and handling.",
                "organizationType",
                "sector",
                "region",
                "mainNeed",
                "handledAt"
            ),
            Template(
                "KPI-PERIOD",
                "KPI reporting period dossier",
                "KpiPeriod",
                "Periodic grant/KPI evidence dossier.",
                "reportingPeriod",
                "kpiCategory",
                "metricValue",
                "source",
                "approvedBy"
            ),
            Template(
                "KPI-CONTACT-BREAKDOWN",
                "Contact intake breakdown",
                "KpiPeriod",
                "Contacts grouped by sector, region, organisation type and DMA need.",
                "reportingPeriod",
                "totalContacts",
                "bySector",
                "byRegion",
                "byOrganizationType",
                "byDmaCategory",
                "sourceQuery"
            ),
            Template(
                "KPI-TICKET-BREAKDOWN",
                "Help-desk ticket breakdown",
                "KpiPeriod",
                "Tickets grouped by category, status, priority, assignee and organisation type.",
                "reportingPeriod",
                "totalTickets",
                "byCategory",
                "byStatus",
                "byPriority",
                "byAssignee",
                "byOrganizationType"
            ),
            Template(
                "KPI-MEETING-REFERRAL",
                "Meetings and referrals breakdown",
                "KpiPeriod",
                "Completed meetings, consultation formats and referrals grouped for programme reporting.",
                "reportingPeriod",
                "requested",
                "completed",
                "byMeetingType",
                "referralsByDestination",
                "sourceQuery"
            ),
            Template(
                "KPI-SUBSCRIPTION-COHORT",
                "Subscription cohort report",
                "KpiPeriod",
                "Invited, activated, expired and cancelled subscriptions for a reporting period.",
                "reportingPeriod",
                "invited",
                "activated",
                "expired",
                "cancelled",
                "activeAtPeriodEnd"
            ),
        };
        var existingTemplateCodes = await db.EvidenceTemplates.Select(x => x.Code).ToListAsync();
        db.EvidenceTemplates.AddRange(
            evidenceTemplates.Where(x =>
                !existingTemplateCodes.Contains(x.Code, StringComparer.OrdinalIgnoreCase)
            )
        );
        if (!await db.ServiceCatalogueItems.AnyAsync())
        {
            var seeds = new[]
            {
                (
                    "ai-readiness",
                    "Digital Maturity Assessment",
                    "Проценка на дигитална зрелост",
                    "Vlerësimi i pjekurisë digjitale"
                ),
                (
                    "ai-act-compliance",
                    "Regulatory Compliance",
                    "Регулаторна усогласеност",
                    "Pajtueshmëri rregullatore"
                ),
                (
                    "test-before-invest",
                    "Test Before Invest",
                    "Тестирај пред инвестиција",
                    "Testo para investimit"
                ),
                (
                    "smart-digital-solutions",
                    "Smart Digital Solutions",
                    "Паметни дигитални решенија",
                    "Zgjidhje digjitale të zgjuara"
                ),
                ("digital-roadmap", "Digital Roadmap", "Дигитален патоказ", "Udhërrëfyes digjital"),
            };
            foreach (var seed in seeds)
            {
                var item = new ServiceCatalogueItem
                {
                    Slug = seed.Item1,
                    Category = "DigitalInnovation",
                };
                db.Add(item);
                db.Translations.AddRange(
                    new Translation
                    {
                        EntityType = nameof(ServiceCatalogueItem),
                        EntityId = item.Id,
                        Language = "en",
                        FieldName = "title",
                        Value = seed.Item2,
                    },
                    new Translation
                    {
                        EntityType = nameof(ServiceCatalogueItem),
                        EntityId = item.Id,
                        Language = "mk",
                        FieldName = "title",
                        Value = seed.Item3,
                    },
                    new Translation
                    {
                        EntityType = nameof(ServiceCatalogueItem),
                        EntityId = item.Id,
                        Language = "sq",
                        FieldName = "title",
                        Value = seed.Item4,
                    }
                );
            }
        }
        await db.SaveChangesAsync();
    }

    private static async Task<AppUser> EnsureBootstrapAdminAsync(
        UserManager<AppUser> users,
        string email,
        string password,
        bool resetPassword
    )
    {
        var admin = await users.FindByEmailAsync(email);
        if (admin is null)
        {
            admin = new AppUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                EmailVerifiedAt = DateTimeOffset.UtcNow,
                Status = UserStatuses.Active,
                FirstName = "Portal",
                LastName = "Admin",
                TermsAcceptedAt = DateTimeOffset.UtcNow,
            };
            ThrowIfFailed(
                await users.CreateAsync(admin, password),
                "The bootstrap administrator could not be created"
            );
        }
        else
        {
            admin.UserName = email;
            admin.EmailConfirmed = true;
            admin.EmailVerifiedAt ??= DateTimeOffset.UtcNow;
            admin.Status = UserStatuses.Active;
            admin.LockoutEnabled = false;
            admin.LockoutEnd = null;
            admin.AccessFailedCount = 0;
            ThrowIfFailed(
                await users.UpdateAsync(admin),
                "The bootstrap administrator could not be updated"
            );

            if (resetPassword)
            {
                var token = await users.GeneratePasswordResetTokenAsync(admin);
                ThrowIfFailed(
                    await users.ResetPasswordAsync(admin, token, password),
                    "The development administrator password could not be reset"
                );
            }
        }

        if (!await users.IsInRoleAsync(admin, "Admin"))
            ThrowIfFailed(
                await users.AddToRoleAsync(admin, "Admin"),
                "The administrator role could not be assigned"
            );
        return admin;
    }

    private static string HighestAccessLevel(IEnumerable<string> roleNames) =>
        roleNames
            .DefaultIfEmpty("Client")
            .OrderByDescending(role => role switch
            {
                "Admin" => 40,
                "HelpDeskAgent" => 30,
                "Expert" => 20,
                "Client" => 10,
                _ => 5,
            })
            .First();

    private static void ThrowIfFailed(IdentityResult result, string message)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(
                message + ": " + string.Join(", ", result.Errors.Select(x => x.Description))
            );
    }

}
