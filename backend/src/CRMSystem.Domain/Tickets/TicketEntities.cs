namespace CRMSystem.Domain.Entities;

public class Ticket : TenantEntity
{
    public string TicketNumber { get; set; } = "";
    public Guid OrganizationId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string Category { get; set; } = "OTHER";
    public string Priority { get; set; } = "Normal";
    public string Status { get; set; } = "New";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid? AssignedAgentId { get; set; }
    public Guid? AssignedExpertId { get; set; }
    public string? FinalRecommendation { get; set; }
    public string? ReferralRecommendation { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
}

public class TicketMessage : TenantEntity
{
    public Guid TicketId { get; set; }
    public Guid SenderUserId { get; set; }
    public string MessageType { get; set; } = "ClientMessage";
    public string Body { get; set; } = "";
    public DateTimeOffset? EditedAt { get; set; }
}

public class TicketAttachment : TenantEntity
{
    public Guid TicketId { get; set; }
    public Guid? MessageId { get; set; }
    public Guid FileId { get; set; }
    public Guid UploadedBy { get; set; }
}
