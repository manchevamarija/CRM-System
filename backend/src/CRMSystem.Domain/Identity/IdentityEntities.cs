using Microsoft.AspNetCore.Identity;

namespace CRMSystem.Domain.Entities;

public class AppUser : IdentityUser<Guid>
{
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string PreferredLanguage { get; set; } = "mk";
    public string Status { get; set; } = UserStatuses.Active;
    public DateTimeOffset? EmailVerifiedAt { get; set; }
    public Guid? OrganizationId { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public DateTimeOffset? TermsAcceptedAt { get; set; }
    public bool MustChangePassword { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class UserStatuses
{
    public const string PendingVerification = "PendingVerification";
    public const string Active = "Active";
    public const string Inactive = "Inactive";

    public static bool IsValid(string status) =>
        status is PendingVerification or Active or Inactive;
}

public static class LegalDocumentVersions
{
    public const string Terms = "terms-2026-07-v1";
    public const string Privacy = "privacy-2026-07-v1";
}

public class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? ReplacedByHash { get; set; }
}

/// <summary>
/// Grants a staff account access to one CRM centre. Identity remains global so a client can
/// follow a handed-over request, while privileged access is explicitly tenant-scoped.
/// </summary>
public class UserTenantMembership : TenantEntity
{
    public Guid UserId { get; set; }
    public string AccessLevel { get; set; } = "Staff";
}
