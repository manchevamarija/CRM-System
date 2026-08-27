using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Infrastructure.Persistence.Repositories;

public sealed class ContactRequestRepository(PortalDbContext db) : IContactRequestRepository
{
    public async Task<IReadOnlyList<Guid>> GetAdminUserIdsAsync(CancellationToken cancellationToken) =>
        await db
            .UserRoles.Join(
                db.Roles.Where(role => role.Name == "Admin"),
                userRole => userRole.RoleId,
                role => role.Id,
                (userRole, _) => userRole.UserId
            )
            .ToListAsync(cancellationToken);

    public async Task<(Guid? UserId, Guid? OrganizationId)> ResolveAssociationAsync(string email, string organizationName, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLower();
        var normalizedOrganization = organizationName.Trim().ToLower();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Email != null && x.Email.ToLower() == normalizedEmail, cancellationToken);
        var organizationId = user?.OrganizationId;
        if (organizationId is null && !string.IsNullOrWhiteSpace(normalizedOrganization))
            organizationId = await db.Organizations.AsNoTracking()
                .Where(x => x.Status == "Approved" && x.Name.ToLower() == normalizedOrganization)
                .OrderBy(x => x.CreatedAt).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(cancellationToken);
        return (user?.Id, organizationId);
    }

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
