using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Infrastructure.Persistence;


public static partial class DatabaseInitializer
{
    private const int CurrentLocalSchemaVersion = 6;

    private static async Task EnsureLocalSchemaAsync(PortalDbContext db)
    {
        if (
            db.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) != true
        )
            return;

        var tenantSqlLiteral = db.CurrentTenantId.Replace("'", "''", StringComparison.Ordinal);

        await EnsureSchemaVersionTableAsync(db);

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "AccountChangeRequests" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_AccountChangeRequests" PRIMARY KEY,
                "UserId" TEXT NOT NULL,
                "OrganizationId" TEXT NOT NULL,
                "RequestType" TEXT NOT NULL,
                "Details" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "DecisionNote" TEXT NULL,
                "DecidedBy" TEXT NULL,
                "DecidedAt" TEXT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_AccountChangeRequests_UserId_Status"
                ON "AccountChangeRequests" ("UserId", "Status");
            """
        );

        // Notifications existed before IsRead/ActionUrl were added to the Notification model —
        // EnsureCreatedAsync only creates tables that don't exist yet, so an already-existing
        // local dev database needs these two columns added by hand, once. We check first so a
        // healthy, already-migrated database never even attempts (and logs) a failing ALTER TABLE.
        await AddColumnIfMissingAsync(db, "Notifications", "IsRead", "INTEGER NOT NULL DEFAULT 0");
        await AddColumnIfMissingAsync(db, "Notifications", "ActionUrl", "TEXT NULL");
        await AddColumnIfMissingAsync(db, "Meetings", "CreatedByUserId", "TEXT NULL");
        await AddColumnIfMissingAsync(db, "ContactRequests", "UserId", "TEXT NULL");
        await AddColumnIfMissingAsync(db, "ContactRequests", "ServiceItemsJson", "TEXT NOT NULL DEFAULT '[]'");
        await AddColumnIfMissingAsync(db, "ContactRequests", "AssignedHelpDeskAdvisorId", "TEXT NULL");
        await AddColumnIfMissingAsync(db, "ContactRequests", "AssignedExpertId", "TEXT NULL");
        await AddColumnIfMissingAsync(db, "ContactRequests", "CreatedTenantId", $"TEXT NOT NULL DEFAULT '{tenantSqlLiteral}'");
        await AddColumnIfMissingAsync(db, "ContactRequests", "OwnerTenantId", $"TEXT NOT NULL DEFAULT '{tenantSqlLiteral}'");
        await AddColumnIfMissingAsync(db, "ContactRequests", "OwnershipTransferredAt", "INTEGER NULL");
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE INDEX IF NOT EXISTS "IX_ContactRequests_CreatedTenantId"
                ON "ContactRequests" ("CreatedTenantId");
            CREATE INDEX IF NOT EXISTS "IX_ContactRequests_OwnerTenantId"
                ON "ContactRequests" ("OwnerTenantId");
            CREATE TABLE IF NOT EXISTS "ContactRequestTransfers" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ContactRequestTransfers" PRIMARY KEY,
                "ContactRequestId" TEXT NOT NULL,
                "FromTenantId" TEXT NOT NULL,
                "ToTenantId" TEXT NOT NULL,
                "Reason" TEXT NOT NULL,
                "ServiceSnapshotJson" TEXT NOT NULL,
                "TransferredBy" TEXT NOT NULL,
                "TransferredAt" INTEGER NOT NULL,
                "CreatedAt" INTEGER NOT NULL,
                "UpdatedAt" INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_ContactRequestTransfers_ContactRequestId_TransferredAt"
                ON "ContactRequestTransfers" ("ContactRequestId", "TransferredAt");
            """
        );
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "ContactRequestAttachments" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ContactRequestAttachments" PRIMARY KEY,
                "ContactRequestId" TEXT NOT NULL,
                "FileId" TEXT NOT NULL,
                "UploadedBy" TEXT NOT NULL,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ContactRequestAttachments_ContactRequestId_FileId"
                ON "ContactRequestAttachments" ("ContactRequestId", "FileId");
            """
        );
        await AddColumnIfMissingAsync(db, "AspNetUsers", "MustChangePassword", "INTEGER NOT NULL DEFAULT 0");
        foreach (var table in new[]
        {
            "Organizations",
            "OrganizationMembers",
            "SubscriptionInvitations",
            "Subscriptions",
            "AccountChangeRequests",
            "Tickets",
            "TicketMessages",
            "TicketAttachments",
            "Meetings",
            "Notifications",
            "ServiceCatalogueItems",
            "ContentPages",
            "Translations",
            "EvidenceFiles",
            "EvidenceTemplates",
            "SystemSettings",
            "AuditLogs",
            "Files",
        })
            await AddColumnIfMissingAsync(db, table, "TenantId", $"TEXT NOT NULL DEFAULT '{tenantSqlLiteral}'");

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "UserTenantMemberships" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_UserTenantMemberships" PRIMARY KEY,
                "TenantId" TEXT NOT NULL,
                "UserId" TEXT NOT NULL,
                "AccessLevel" TEXT NOT NULL,
                "CreatedAt" INTEGER NOT NULL,
                "UpdatedAt" INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserTenantMemberships_TenantId_UserId"
                ON "UserTenantMemberships" ("TenantId", "UserId");
            CREATE INDEX IF NOT EXISTS "IX_Organizations_TenantId" ON "Organizations" ("TenantId");
            CREATE INDEX IF NOT EXISTS "IX_Tickets_TenantId" ON "Tickets" ("TenantId");
            CREATE INDEX IF NOT EXISTS "IX_Meetings_TenantId" ON "Meetings" ("TenantId");
            CREATE INDEX IF NOT EXISTS "IX_Notifications_TenantId" ON "Notifications" ("TenantId");
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TenantId" ON "AuditLogs" ("TenantId");
            CREATE INDEX IF NOT EXISTS "IX_Files_TenantId_Id" ON "Files" ("TenantId", "Id");
            """
        );
        await db.Database.ExecuteSqlRawAsync("UPDATE ContactRequests SET Status = 'Applied' WHERE Status = 'New'");
        await db.Database.ExecuteSqlRawAsync("UPDATE ContactRequests SET Status = 'Contacting' WHERE Status IN ('Responded', 'RegistrationInvited')");
        await db.Database.ExecuteSqlRawAsync("UPDATE ContactRequests SET Status = 'Served' WHERE Status = 'Handled'");
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "SchemaVersions" SET "Version" = {CurrentLocalSchemaVersion}, "AppliedAt" = {DateTimeOffset.UtcNow} WHERE "Id" = 1;"""
        );
    }

    private static async Task EnsureSchemaVersionTableAsync(PortalDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "SchemaVersions" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_SchemaVersions" PRIMARY KEY,
                "Version" INTEGER NOT NULL,
                "AppliedAt" TEXT NOT NULL
            );
            INSERT OR IGNORE INTO "SchemaVersions" ("Id", "Version", "AppliedAt")
                VALUES (1, 0, CURRENT_TIMESTAMP);
            """
        );
    }

    private static async Task<bool> ColumnExistsAsync(PortalDbContext db, string table, string column)
    {
        await using var connection = db.Database.GetDbConnection();
        var wasClosed = connection.State != System.Data.ConnectionState.Open;
        if (wasClosed)
            await connection.OpenAsync();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"""PRAGMA table_info("{table}");""";
            await using var reader = await command.ExecuteReaderAsync();
            var nameOrdinal = -1;
            while (await reader.ReadAsync())
            {
                if (nameOrdinal < 0)
                    nameOrdinal = reader.GetOrdinal("name");
                if (string.Equals(reader.GetString(nameOrdinal), column, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }
        finally
        {
            if (wasClosed)
                await connection.CloseAsync();
        }
    }

    private static async Task AddColumnIfMissingAsync(
        PortalDbContext db,
        string table,
        string column,
        string columnDefinition
    )
    {
        if (await ColumnExistsAsync(db, table, column))
            return;
        // Table, column and definition come only from the fixed calls above; SQL identifiers
        // cannot be passed as database parameters.
#pragma warning disable EF1002
        await db.Database.ExecuteSqlRawAsync(
            $"""ALTER TABLE "{table}" ADD COLUMN "{column}" {columnDefinition};"""
        );
#pragma warning restore EF1002
    }

    private static async Task EnsureDemoClientAsync(
        UserManager<AppUser> users,
        PortalDbContext db,
        AppUser admin,
        IConfiguration configuration
    )
    {
        var now = DateTimeOffset.UtcNow;
        var email = configuration["DemoAccount:Email"] ?? "client@crmsystem.mk";
        var password = configuration["DemoAccount:Password"] ?? "CRMSystem!2026Client";
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new AppUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                EmailVerifiedAt = now,
                Status = UserStatuses.Active,
                FirstName = "Demo",
                LastName = "Client",
                PreferredLanguage = "mk",
                TermsAcceptedAt = now,
                LockoutEnabled = false,
            };
            var result = await users.CreateAsync(user, password);
            if (!result.Succeeded)
                throw new InvalidOperationException(
                    "The local demo client could not be created: "
                        + string.Join(", ", result.Errors.Select(x => x.Description))
                );
        }

        var demoRoles = await users.GetRolesAsync(user);
        foreach (var role in demoRoles.Where(role => role != "Client"))
        {
            var removeRole = await users.RemoveFromRoleAsync(user, role);
            if (!removeRole.Succeeded)
                throw new InvalidOperationException(
                    $"The local demo client role {role} could not be removed: "
                        + string.Join(", ", removeRole.Errors.Select(x => x.Description))
                );
        }
        if (!await users.IsInRoleAsync(user, "Client"))
        {
            var addClientRole = await users.AddToRoleAsync(user, "Client");
            if (!addClientRole.Succeeded)
                throw new InvalidOperationException(
                    "The local demo client role could not be restored: "
                        + string.Join(", ", addClientRole.Errors.Select(x => x.Description))
                );
        }

        user.EmailConfirmed = true;
        user.EmailVerifiedAt ??= now;
        user.Status = UserStatuses.Active;
        user.LockoutEnabled = false;
        user.LockoutEnd = null;
        user.AccessFailedCount = 0;
        var updateResult = await users.UpdateAsync(user);
        if (!updateResult.Succeeded)
            throw new InvalidOperationException(
                "The local demo client could not be refreshed: "
                    + string.Join(", ", updateResult.Errors.Select(x => x.Description))
            );

        var organization = await db.Organizations.SingleOrDefaultAsync(x =>
            x.CreatedByUserId == user.Id && x.Name == "CRM System Demo Organization"
        );
        if (organization is null)
        {
            organization = new Organization
            {
                Name = "CRM System Demo Organization",
                Type = "SME",
                Sector = "Information technology",
                Municipality = "Skopje",
                Region = "Skopje",
                EmployeeCount = 25,
                Status = "Approved",
                CreatedByUserId = user.Id,
                ApprovedBy = admin.Id,
                ApprovedAt = now,
            };
            db.Organizations.Add(organization);
        }
        else
        {
            organization.Status = "Approved";
            organization.ApprovedBy ??= admin.Id;
            organization.ApprovedAt ??= now;
        }

        user.OrganizationId = organization.Id;
        if (
            !await db.OrganizationMembers.AnyAsync(x =>
                x.OrganizationId == organization.Id && x.UserId == user.Id
            )
        )
            db.OrganizationMembers.Add(
                new OrganizationMember
                {
                    OrganizationId = organization.Id,
                    UserId = user.Id,
                    MemberStatus = "Active",
                    IsPrimaryContact = true,
                }
            );
        if (
            !await db.Subscriptions.AnyAsync(x =>
                x.UserId == user.Id && x.Status == "Active" && x.ExpiresAt > now
            )
        )
            db.Subscriptions.Add(
                new Subscription
                {
                    UserId = user.Id,
                    OrganizationId = organization.Id,
                    Status = "Active",
                    StartsAt = now,
                    ExpiresAt = now.AddMonths(12),
                    OfflinePaymentReference = "LOCAL-DEMO",
                    PaymentNote = "Development-only seeded subscription",
                    InvitedBy = admin.Id,
                    ActivatedBy = admin.Id,
                    ActivatedAt = now,
                }
            );
    }

    private static EvidenceTemplate Template(
        string code,
        string name,
        string entityType,
        string description,
        params string[] metadata
    ) =>
        new()
        {
            Code = code,
            Name = name,
            RelatedEntityType = entityType,
            Description = description,
            RequiredMetadataJson = JsonSerializer.Serialize(metadata),
            IsActive = true,
        };
}
