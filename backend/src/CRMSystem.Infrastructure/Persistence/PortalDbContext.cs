using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using CRMSystem.Application.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CRMSystem.Infrastructure.Persistence;

public class PortalDbContext(
    DbContextOptions<PortalDbContext> options,
    IHttpContextAccessor? httpContext = null,
    ITenantContext? tenantContext = null
) : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IPortalDbContext
{
    public string CurrentTenantId => tenantContext?.Current.Id ?? "crm";

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
    public DbSet<SubscriptionInvitation> SubscriptionInvitations => Set<SubscriptionInvitation>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<AccountChangeRequest> AccountChangeRequests => Set<AccountChangeRequest>();
    public DbSet<ContactRequest> ContactRequests => Set<ContactRequest>();
    public DbSet<ContactRequestTransfer> ContactRequestTransfers => Set<ContactRequestTransfer>();
    public DbSet<ContactRequestAttachment> ContactRequestAttachments => Set<ContactRequestAttachment>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketMessage> TicketMessages => Set<TicketMessage>();
    public DbSet<TicketAttachment> TicketAttachments => Set<TicketAttachment>();
    public DbSet<Meeting> Meetings => Set<Meeting>();
    public DbSet<ServiceCatalogueItem> ServiceCatalogueItems => Set<ServiceCatalogueItem>();
    public DbSet<ContentPage> ContentPages => Set<ContentPage>();
    public DbSet<Translation> Translations => Set<Translation>();
    public DbSet<EvidenceFile> EvidenceFiles => Set<EvidenceFile>();
    public DbSet<EvidenceTemplate> EvidenceTemplates => Set<EvidenceTemplate>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<FileObject> Files => Set<FileObject>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<UserTenantMembership> UserTenantMemberships => Set<UserTenantMembership>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<AuditLog>().HasKey(x => x.Id);
        builder.Entity<FileObject>().HasIndex(x => new { x.TenantId, x.Id });
        builder.Entity<Ticket>().HasIndex(x => new { x.TenantId, x.TicketNumber }).IsUnique();
        builder.Entity<TicketAttachment>().HasIndex(x => new { x.TicketId, x.FileId }).IsUnique();
        builder.Entity<EvidenceTemplate>().HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        builder.Entity<AppUser>().HasIndex(x => x.OrganizationId);
        builder.Entity<AccountChangeRequest>().HasIndex(x => new { x.UserId, x.Status });
        builder.Entity<ContactRequest>().HasIndex(x => x.UserId);
        builder.Entity<ContactRequest>().HasIndex(x => x.Email);
        builder.Entity<ContactRequest>().HasIndex(x => x.CreatedTenantId);
        builder.Entity<ContactRequest>().HasIndex(x => x.OwnerTenantId);
        builder.Entity<ContactRequestTransfer>().HasIndex(x => new { x.ContactRequestId, x.TransferredAt });
        builder.Entity<ContactRequestAttachment>().HasIndex(x => new { x.ContactRequestId, x.FileId }).IsUnique();
        builder
            .Entity<OrganizationMember>()
            .HasIndex(x => new { x.OrganizationId, x.UserId })
            .IsUnique();
        builder
            .Entity<Translation>()
            .HasIndex(x => new
            {
                x.TenantId,
                x.EntityType,
                x.EntityId,
                x.Language,
                x.FieldName,
            })
            .IsUnique();
        builder.Entity<SystemSetting>().HasIndex(x => new { x.TenantId, x.Key }).IsUnique();
        builder.Entity<ServiceCatalogueItem>().HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
        builder.Entity<ContentPage>().HasIndex(x => new { x.TenantId, x.Slug }).IsUnique();
        builder.Entity<UserTenantMembership>().HasIndex(x => new { x.TenantId, x.UserId }).IsUnique();

        ConfigureTenantFilters(builder);

        ConfigureSqliteDates(builder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantIsolation();
        ApplyTimestamps();
        PreserveAuditRecords();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyTenantIsolation();
        ApplyTimestamps();
        PreserveAuditRecords();
        return base.SaveChanges();
    }

    private void ConfigureTenantFilters(ModelBuilder builder)
    {
        builder.Entity<Organization>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<OrganizationMember>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<SubscriptionInvitation>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<Subscription>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<AccountChangeRequest>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<Ticket>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<TicketMessage>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<TicketAttachment>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<Meeting>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<Notification>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<ServiceCatalogueItem>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<ContentPage>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<Translation>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<EvidenceFile>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<EvidenceTemplate>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<SystemSetting>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<UserTenantMembership>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<AuditLog>().HasQueryFilter(x => x.TenantId == CurrentTenantId);
        builder.Entity<FileObject>().HasQueryFilter(file =>
            file.TenantId == CurrentTenantId
            || ContactRequestAttachments.Any(attachment =>
                attachment.FileId == file.Id
                && ContactRequests.Any(request =>
                    request.Id == attachment.ContactRequestId
                    && (request.CreatedTenantId == CurrentTenantId || request.OwnerTenantId == CurrentTenantId))));

        // The original and current centres can inspect the same request; only the current owner
        // is allowed to mutate it by the command endpoints.
        builder.Entity<ContactRequest>().HasQueryFilter(x =>
            x.CreatedTenantId == CurrentTenantId || x.OwnerTenantId == CurrentTenantId);
        builder.Entity<ContactRequestTransfer>().HasQueryFilter(x =>
            x.FromTenantId == CurrentTenantId || x.ToTenantId == CurrentTenantId);
        builder.Entity<ContactRequestAttachment>().HasQueryFilter(x =>
            ContactRequests.Any(request =>
                request.Id == x.ContactRequestId
                && (request.CreatedTenantId == CurrentTenantId || request.OwnerTenantId == CurrentTenantId)));
    }

    private void ApplyTenantIsolation()
    {
        var tenantId = CurrentTenantId;
        foreach (var entry in ChangeTracker.Entries<ITenantOwned>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.TenantId = tenantId;
                continue;
            }

            if (entry.State is not (EntityState.Modified or EntityState.Deleted))
                continue;

            var originalTenant = Convert.ToString(
                entry.Property(nameof(ITenantOwned.TenantId)).OriginalValue,
                System.Globalization.CultureInfo.InvariantCulture) ?? "";
            if (!string.Equals(originalTenant, tenantId, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Cross-tenant data modification is not allowed.");

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.TenantId = originalTenant;
                entry.Property(nameof(ITenantOwned.TenantId)).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<AuditLog>().Where(x => x.State == EntityState.Added))
            entry.Entity.TenantId = tenantId;
    }

    private void ApplyTimestamps()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (
            var entry in ChangeTracker.Entries<Entity>().Where(x => x.State == EntityState.Modified)
        )
            entry.Entity.UpdatedAt = now;

        foreach (
            var entry in ChangeTracker
                .Entries<AppUser>()
                .Where(x => x.State is EntityState.Added or EntityState.Modified)
        )
        {
            if (entry.State == EntityState.Added)
                entry.Entity.CreatedAt = now;
            entry.Entity.UpdatedAt = now;
            SynchronizeEmailLifecycle(entry.Entity, now);
        }
    }

    private static void SynchronizeEmailLifecycle(AppUser user, DateTimeOffset now)
    {
        if (user.EmailConfirmed)
        {
            user.EmailVerifiedAt ??= now;
            if (user.Status == UserStatuses.PendingVerification)
                user.Status = UserStatuses.Active;
            return;
        }

        user.EmailVerifiedAt = null;
        if (user.Status == UserStatuses.Active)
            user.Status = UserStatuses.PendingVerification;
    }

    private void PreserveAuditRecords()
    {
        foreach (
            var entry in ChangeTracker.Entries<AuditLog>().Where(x => x.State == EntityState.Added)
        )
            entry.Entity.ActorIp ??=
                httpContext?.HttpContext?.Connection.RemoteIpAddress?.ToString();
        foreach (
            var entry in ChangeTracker
                .Entries<AuditLog>()
                .Where(x => x.State is EntityState.Modified or EntityState.Deleted)
        )
            entry.State = EntityState.Unchanged;
    }

    private void ConfigureSqliteDates(ModelBuilder builder)
    {
        if (Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite")
            return;

        var requiredConverter = new ValueConverter<DateTimeOffset, long>(
            value => value.UtcDateTime.Ticks,
            value => new DateTimeOffset(value, TimeSpan.Zero)
        );
        var optionalConverter = new ValueConverter<DateTimeOffset?, long?>(
            value => value.HasValue ? value.Value.UtcDateTime.Ticks : null,
            value => value.HasValue ? new DateTimeOffset(value.Value, TimeSpan.Zero) : null
        );

        foreach (
            var property in builder
                .Model.GetEntityTypes()
                .SelectMany(entity => entity.GetProperties())
        )
        {
            if (property.ClrType == typeof(DateTimeOffset))
                property.SetValueConverter(requiredConverter);
            else if (property.ClrType == typeof(DateTimeOffset?))
                property.SetValueConverter(optionalConverter);
        }
    }
}
