using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Infrastructure.Persistence.Repositories;

public sealed class ContactRequestRepository(PortalDbContext db) : IContactRequestRepository
{
    public async Task<IReadOnlyList<Guid>> GetAdminUserIdsAsync(string brandCode, CancellationToken cancellationToken) =>
        await StaffNotificationRecipients.GetAsync(db, cancellationToken, brandCode);

    public async Task<(Guid? UserId, Guid? OrganizationId)> ResolveAssociationAsync(string email, string organizationName, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLower();
        var normalizedOrganization = organizationName.Trim().ToLower();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Email != null && x.Email.ToLower() == normalizedEmail, cancellationToken);
        var organizationId = user?.OrganizationId;
        if (organizationId is null && !string.IsNullOrWhiteSpace(normalizedOrganization))
            organizationId = await db.Organizations.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.Status == "Approved" && x.Name.ToLower() == normalizedOrganization)
                .OrderBy(x => x.CreatedAt).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(cancellationToken);
        return (user?.Id, organizationId);
    }

    public Task<bool> AffiliateClickExistsAsync(string clickId, string affiliateCode, string? partnerCode, CancellationToken cancellationToken) =>
        db.AffiliateClicks.IgnoreQueryFilters().AsNoTracking().AnyAsync(
            x => x.ClickId == clickId
                && x.AffiliateCode == affiliateCode
                && x.PartnerCode == partnerCode,
            cancellationToken);

    public Task<ContactRequest?> FindByGoogleFormResponseIdAsync(string responseId, CancellationToken cancellationToken) =>
        db.ContactRequests.IgnoreQueryFilters().FirstOrDefaultAsync(
            x => x.GoogleFormResponseId == responseId.Trim(),
            cancellationToken);

    public async Task SetGoogleFormResponseIdAsync(Guid contactRequestId, string responseId, CancellationToken cancellationToken)
    {
        var request = await db.ContactRequests.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == contactRequestId, cancellationToken);
        if (request is null) return;
        request.GoogleFormResponseId = responseId.Trim();
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Guid?> FindPartnerLinkedOrganizationIdAsync(string brandCode, string? partnerCode, CancellationToken cancellationToken) =>
        db.AffiliatePartners.AsNoTracking()
            .Where(x => x.IsActive && x.BrandCode == brandCode && x.PartnerCode == (partnerCode ?? "") && x.LinkedOrganizationId != null)
            .Select(x => x.LinkedOrganizationId)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task AddAsync(
        ContactRequest request,
        IReadOnlyList<Notification> notifications,
        AuditLog auditLog,
        CancellationToken cancellationToken
    )
    {
        db.ContactRequests.Add(request);
        db.Notifications.AddRange(notifications);
        db.AuditLogs.Add(auditLog);
        await db.SaveChangesAsync(cancellationToken);
    }
}
