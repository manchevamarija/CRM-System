namespace CRMSystem.Domain.Entities;

public class Organization : TenantEntity
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "SME";
    public string? Sector { get; set; }
    public string? Municipality { get; set; }
    public string? Region { get; set; }
    public string? Website { get; set; }
    public int? EmployeeCount { get; set; }
    public string Status { get; set; } = "PendingApproval";
    public Guid CreatedByUserId { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
}

public class OrganizationMember : TenantEntity
{
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public string MemberStatus { get; set; } = "Active";
    public bool IsPrimaryContact { get; set; }
}

public class SubscriptionInvitation : TenantEntity
{
    public Guid UserId { get; set; }
    public Guid OrganizationId { get; set; }
    public string TokenHash { get; set; } = "";
    public string Status { get; set; } = "Invited";
    public DateTimeOffset ExpiresAt { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
}

public class Subscription : TenantEntity
{
    public Guid UserId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? InvitationId { get; set; }
    public string Status { get; set; } = "PendingPayment";
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public string? OfflinePaymentReference { get; set; }
    public string? PaymentNote { get; set; }
    public Guid? InvitedBy { get; set; }
    public Guid? ActivatedBy { get; set; }
    public DateTimeOffset? ActivatedAt { get; set; }
    public Guid? CancelledBy { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
}

public class AccountChangeRequest : TenantEntity
{
    public Guid UserId { get; set; }
    public Guid OrganizationId { get; set; }
    public string RequestType { get; set; } = "Organization";
    public string Details { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public string? DecisionNote { get; set; }
    public Guid? DecidedBy { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}
