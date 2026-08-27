using CRMSystem.Application.Tenancy;
using CRMSystem.Domain.Entities;
using CRMSystem.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CRMSystem.Infrastructure.Tests;

public sealed class TenantIsolationTests
{
    [Fact]
    public async Task Tenant_owned_rows_are_automatically_scoped()
    {
        await using var database = await TestDatabase.CreateAsync();
        var digitmakOrganizationId = Guid.NewGuid();

        await using (var digitmak = database.Context("digitmak"))
        {
            digitmak.Organizations.Add(new Organization
            {
                Id = digitmakOrganizationId,
                Name = "CRM System client",
                CreatedByUserId = Guid.NewGuid(),
            });
            digitmak.Files.Add(new FileObject
            {
                OriginalFilename = "tenant-document.pdf",
                StoredPath = "digitmak/tenant-document.pdf",
                ContentType = "application/pdf",
                SizeBytes = 42,
                Checksum = "TEST",
                UploadedBy = Guid.NewGuid(),
                EntityType = nameof(ContactRequest),
                EntityId = Guid.NewGuid(),
            });
            await digitmak.SaveChangesAsync();
        }

        await using (var vezilka = database.Context("vezilka"))
        {
            Assert.Empty(await vezilka.Organizations.ToListAsync());
            Assert.Empty(await vezilka.Files.ToListAsync());
            vezilka.Organizations.Add(new Organization
            {
                Name = "Vezilka client",
                CreatedByUserId = Guid.NewGuid(),
            });
            await vezilka.SaveChangesAsync();
        }

        await using var digitmakRead = database.Context("digitmak");
        var organizations = await digitmakRead.Organizations.ToListAsync();
        Assert.Single(organizations);
        Assert.Equal(digitmakOrganizationId, organizations[0].Id);
        Assert.Equal("digitmak", organizations[0].TenantId);
        Assert.Equal("digitmak", (await digitmakRead.Files.SingleAsync()).TenantId);
    }

    [Fact]
    public async Task Cross_tenant_updates_are_rejected_even_if_filters_are_bypassed()
    {
        await using var database = await TestDatabase.CreateAsync();
        Guid organizationId;

        await using (var digitmak = database.Context("digitmak"))
        {
            var organization = new Organization
            {
                Name = "Protected client",
                CreatedByUserId = Guid.NewGuid(),
            };
            digitmak.Add(organization);
            await digitmak.SaveChangesAsync();
            organizationId = organization.Id;
        }

        await using var hpc = database.Context("hpc");
        var foreign = await hpc.Organizations.IgnoreQueryFilters().SingleAsync(x => x.Id == organizationId);
        foreign.Name = "Illegal update";

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => hpc.SaveChangesAsync());
        Assert.Contains("Cross-tenant", error.Message);
    }

    [Fact]
    public async Task Handover_keeps_one_request_visible_to_origin_and_new_owner_only()
    {
        await using var database = await TestDatabase.CreateAsync();
        var requestId = Guid.NewGuid();
        var fileId = Guid.NewGuid();

        await using (var digitmak = database.Context("digitmak"))
        {
            digitmak.ContactRequests.Add(new ContactRequest
            {
                Id = requestId,
                CreatedTenantId = "digitmak",
                OwnerTenantId = "vezilka",
                OrganizationName = "Shared client",
                ContactName = "Client",
                Email = "client@example.test",
                MainNeed = "Transfer the complete request",
            });
            digitmak.Files.Add(new FileObject
            {
                Id = fileId,
                OriginalFilename = "handover.pdf",
                StoredPath = "digitmak/handover.pdf",
                ContentType = "application/pdf",
                SizeBytes = 42,
                Checksum = "HANDOVER",
                UploadedBy = Guid.NewGuid(),
                EntityType = nameof(ContactRequest),
                EntityId = requestId,
            });
            digitmak.ContactRequestAttachments.Add(new ContactRequestAttachment
            {
                ContactRequestId = requestId,
                FileId = fileId,
                UploadedBy = Guid.NewGuid(),
            });
            await digitmak.SaveChangesAsync();
        }

        await using var origin = database.Context("digitmak");
        await using var owner = database.Context("vezilka");
        await using var unrelated = database.Context("bau");

        Assert.Equal(requestId, (await origin.ContactRequests.SingleAsync()).Id);
        Assert.Equal(requestId, (await owner.ContactRequests.SingleAsync()).Id);
        Assert.Equal(fileId, (await origin.Files.SingleAsync()).Id);
        Assert.Equal(fileId, (await owner.Files.SingleAsync()).Id);
        Assert.Empty(await unrelated.ContactRequests.ToListAsync());
        Assert.Empty(await unrelated.Files.ToListAsync());
    }

    [Fact]
    public async Task Staff_memberships_are_tenant_specific()
    {
        await using var database = await TestDatabase.CreateAsync();
        var userId = Guid.NewGuid();

        await using (var hpc = database.Context("hpc"))
        {
            hpc.UserTenantMemberships.Add(new UserTenantMembership { UserId = userId, AccessLevel = "Admin" });
            await hpc.SaveChangesAsync();
        }

        await using var hpcRead = database.Context("hpc");
        await using var bauRead = database.Context("bau");
        Assert.True(await hpcRead.UserTenantMemberships.AnyAsync(x => x.UserId == userId));
        Assert.False(await bauRead.UserTenantMemberships.AnyAsync(x => x.UserId == userId));
    }

    private sealed class TestDatabase : IAsyncDisposable
    {
        private readonly SqliteConnection connection;

        private TestDatabase(SqliteConnection connection) => this.connection = connection;

        public static async Task<TestDatabase> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var database = new TestDatabase(connection);
            await using var setup = database.Context("crm");
            await setup.Database.EnsureCreatedAsync();
            return database;
        }

        public PortalDbContext Context(string tenantId)
        {
            var options = new DbContextOptionsBuilder<PortalDbContext>()
                .UseSqlite(connection)
                .EnableSensitiveDataLogging()
                .Options;
            return new PortalDbContext(options, tenantContext: new TestTenantContext(tenantId));
        }

        public async ValueTask DisposeAsync() => await connection.DisposeAsync();
    }

    private sealed class TestTenantContext(string id) : ITenantContext
    {
        public TenantDescriptor Current { get; } = new(id, id, id, $"support@{id}.test", "#123456", "#abcdef");
    }
}
