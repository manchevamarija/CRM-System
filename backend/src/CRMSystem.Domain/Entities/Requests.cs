namespace CRMSystem.Domain.Entities;

public record RegisterRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string PreferredLanguage,
    string? Phone,
    bool TermsAccepted = true,
    string TermsVersion = LegalDocumentVersions.Terms,
    string PrivacyVersion = LegalDocumentVersions.Privacy,
    Guid? ContactRequestId = null
);

public record LoginRequest(string Email, string Password);

public record EmailRequest(string Email);

public record VerifyEmailRequest(string UserId, string Token);

public record ResetPasswordRequest(string Email, string Token, string NewPassword);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record OrganizationRequest(
    string Name,
    string Type,
    string? Sector,
    string? Municipality,
    string? Region,
    string? Website,
    int? EmployeeCount
);

public record ProfileRequest(
    string FirstName,
    string LastName,
    string? Phone,
    string PreferredLanguage
);

public record ContactRequestDto(
    string OrganizationName,
    string OrganizationType,
    string? Sector,
    string? Municipality,
    string? Region,
    string? Website,
    string ContactName,
    string Email,
    string? Phone,
    string? PreferredLanguage,
    int? EmployeeCount,
    int? DigitalMaturityRating,
    string MainNeed,
    string ChallengeDescription,
    string? CurrentTools,
    string? CurrentDataSources,
    bool? UsesAi,
    string? AiUseCase,
    string? PrivacyConcerns,
    bool InterestedInAiActGuidance,
    string? TrainingNeeds,
    string? DesiredTimeline,
    string? PreferredConsultationFormat,
    bool ConsentToContact,
    bool PrivacyPolicyAccepted,
    string? DmaCategory = null,
    string? RequestType = null,
    string? TaxNumber = null,
    string? RegistrationNumber = null,
    string? Address = null,
    string? SelectedServices = null,
    string? BudgetRange = null,
    string? AffiliateCode = null,
    string? PartnerCode = null,
    string? AffiliateClickId = null,
    string? SourceTenantId = null,
    string? AttributionStatus = null,
    string? AttributionReason = null
);

public record AffiliateClickRequest(
    string Code,
    string? PartnerCode = null,
    string? LandingPath = null,
    string? Referrer = null
);

/// <summary>Legacy browser-side affiliate conversion signal. New Google Form attribution
/// is authoritative from the webhook and does not depend on iframe load events.</summary>
public record AffiliateConvertRequest(
    string ClickId,
    string AffiliateCode,
    string? PartnerCode = null
);

/// <summary>Payload sent by the Google Apps Script bound to the external Google Form,
/// once per new form submission. See docs/affiliate-marketing.md for the exact field
/// mapping and the Apps Script code that produces this shape.</summary>
public record GoogleFormSubmissionRequest(
    string Brand,
    string FullName,
    string Email,
    string? Phone,
    string OrganizationName,
    string? OrganizationType,
    string Need,
    bool Consent,
    string? FormResponseId = null,
    DateTimeOffset? SubmittedAt = null
);

public record TicketRequest(string Category, string Title, string Description, string? Priority);

public record AdminTicketRequest(
    Guid UserId,
    Guid? OrganizationId,
    string Category,
    string Title,
    string Description,
    string? Priority
);

public record TicketAssignmentRequest(Guid? AgentId, Guid? ExpertId);

public record TicketRecommendationRequest(
    string FinalRecommendation,
    string? ReferralRecommendation
);

public record MessageRequest(string Body);

public record MeetingRequest(
    string Subject,
    string Description,
    string MeetingType,
    Guid? TicketId,
    DateTimeOffset? PreferredStart,
    DateTimeOffset? PreferredEnd,
    string? RequestedTimeWindow,
    string? Location,
    string? OnlineLink,
    string? Notes
);

public record AdminMeetingRequest(Guid UserId, MeetingRequest Meeting);

public record MeetingDecisionRequest(
    DateTimeOffset? StartsAt,
    DateTimeOffset? EndsAt,
    string? Location,
    string? OnlineLink,
    string? Notes,
    Guid? AssignedUserId,
    Guid? OrganizationId
);

public record MeetingRescheduleRequest(
    DateTimeOffset? PreferredStart,
    DateTimeOffset? PreferredEnd,
    string? RequestedTimeWindow,
    string? Notes
);

public record SubscriptionInviteRequest(Guid UserId, Guid OrganizationId);

public record SubscriptionActivationRequest(string PaymentReference, string? PaymentNote);

public record AccountChangeRequestDto(string RequestType, string Details);

public record AccountChangeDecisionRequest(string Status, string? Note);

public record ApplyOrganizationChangeRequest(Guid OrganizationId);

public record ContactUpdateRequest(
    string Status,
    Guid? AssignedTo,
    Guid? LinkedOrganizationId,
    string? DmaCategory = null,
    string? InternalNote = null
);
public record ContactAssignmentRequest(Guid AgentId, Guid? HelpDeskAdvisorId, Guid? ExpertId);
public record ContactRequestTransferRequest(string DestinationTenantId, string Reason);
public record ContactRequestTransferApprovalRequest(string Decision);

public record UserUpdateRequest(string Status, string PreferredLanguage, string? Phone);

public record RolesRequest(string[] Roles);
public record CreateRoleRequest(string Name);
public record CreateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string Role,
    string PreferredLanguage = "mk",
    string? AssignedBrand = null,
    string? AssignedPartnerCode = null
);

public record ContactServiceItemUpdateRequest(
    string Status,
    decimal? Price,
    DateTimeOffset? Deadline,
    Guid? AssignedAgentId
);

public record ContentUpsertRequest(
    string Slug,
    string Status,
    string Category,
    Dictionary<string, Dictionary<string, string>> Translations
);

public record SettingRequest(string Value, string? Description);

public record EvidenceTemplateRequest(
    string Code,
    string Name,
    string RelatedEntityType,
    string Description,
    string[] RequiredMetadata,
    bool IsActive = true
);
