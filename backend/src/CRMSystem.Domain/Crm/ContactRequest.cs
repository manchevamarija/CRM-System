namespace CRMSystem.Domain.Entities;

public class ContactRequest : Entity
{
    /// <summary>The centre through which the request originally entered the shared CRM.</summary>
    public string CreatedTenantId { get; set; } = "crm";

    /// <summary>The centre currently responsible for the request. A handover changes this value, not the request id.</summary>
    public string OwnerTenantId { get; set; } = "crm";

    /// <summary>Affiliate/referral source tenant. This is attribution only and never changes ownership. </summary>
    public string? SourceTenantId { get; set; }

    public DateTimeOffset? OwnershipTransferredAt { get; set; }
    public Guid? UserId { get; set; }
    public string RequestType { get; set; } = "Consultation";
    public string OrganizationName { get; set; } = "";
    public string OrganizationType { get; set; } = "SME";
    public string? Sector { get; set; }
    public string? Municipality { get; set; }
    public string? Region { get; set; }
    public string? Website { get; set; }
    public string? TaxNumber { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? Address { get; set; }
    public string ContactName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string PreferredLanguage { get; set; } = "mk";
    public int? EmployeeCount { get; set; }
    public int? DigitalMaturityRating { get; set; }
    public string DmaCategory { get; set; } = "DIGITAL_READINESS";
    public string MainNeed { get; set; } = "";
    public string ChallengeDescription { get; set; } = "";
    public string? CurrentTools { get; set; }
    public string? CurrentDataSources { get; set; }
    public bool? UsesAi { get; set; }
    public string? AiUseCase { get; set; }
    public string? PrivacyConcerns { get; set; }
    public bool InterestedInAiActGuidance { get; set; }
    public string? TrainingNeeds { get; set; }
    public string? DesiredTimeline { get; set; }
    public string? PreferredConsultationFormat { get; set; }
    public string? SelectedServices { get; set; }
    public string ServiceItemsJson { get; set; } = "[]";
    public string? BudgetRange { get; set; }
    public string? AffiliateCode { get; set; }
    /// <summary>The specific partner under the affiliate brand (e.g. "acme-agency" in
    /// /digitmak/acme-agency). Open-ended — new partners never require a code change.</summary>
    public string? PartnerCode { get; set; }
    public string? AffiliateClickId { get; set; }
    /// <summary>The Google Form response id (from Apps Script's e.response.getId()), used
    /// to make the webhook idempotent — the same form submission can trigger the Apps
    /// Script more than once (retries, double network sends), and this lets the webhook
    /// recognise a repeat and return the existing lead instead of creating a duplicate.</summary>
    public string? GoogleFormResponseId { get; set; }
    /// <summary>Strict server-side affiliate attribution state for Google Form submissions.
    /// Attributed means one unambiguous affiliate click was matched; Ambiguous means multiple
    /// plausible clicks existed; Unattributed means no safe click existed. This prevents the CRM
    /// from ever inventing a partner attribution.</summary>
    public string AttributionStatus { get; set; } = "Unattributed";
    public string? AttributionReason { get; set; }
    public string? InternalNote { get; set; }
    public bool ConsentToContact { get; set; }
    public bool PrivacyPolicyAccepted { get; set; }
    public string Status { get; set; } = "Applied";
    public Guid? AssignedTo { get; set; }
    public Guid? AssignedHelpDeskAdvisorId { get; set; }
    public Guid? AssignedExpertId { get; set; }
    public Guid? LinkedOrganizationId { get; set; }
}

/// <summary>
/// Immutable audit record for a complete inter-centre handover. The contact request, services,
/// documents and client relationship remain on the original ContactRequest row.
/// </summary>
public class ContactRequestTransfer : Entity
{
    public Guid ContactRequestId { get; set; }
    public string FromTenantId { get; set; } = "";
    public string ToTenantId { get; set; } = "";
    public string Reason { get; set; } = "";
    public string ServiceSnapshotJson { get; set; } = "[]";
    public Guid TransferredBy { get; set; }
    /// <summary>When the change-of-owner request was created. Kept for compatibility with the original transfer history. </summary>
    public DateTimeOffset TransferredAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>When the ownership change actually completed after both approvals. Null while pending/rejected. </summary>
    public DateTimeOffset? CompletedAt { get; set; }
    /// <summary>Pending until both the source and destination responsible admins approve the change.</summary>
    public string ApprovalStatus { get; set; } = "Pending";
    public Guid? SourceApprovedBy { get; set; }
    public DateTimeOffset? SourceApprovedAt { get; set; }
    public Guid? DestinationApprovedBy { get; set; }
    public DateTimeOffset? DestinationApprovedAt { get; set; }
}

public class ContactRequestAttachment : Entity
{
    public Guid ContactRequestId { get; set; }
    public Guid FileId { get; set; }
    public Guid UploadedBy { get; set; }
}
