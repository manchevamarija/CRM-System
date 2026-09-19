using System.ComponentModel.DataAnnotations.Schema;

namespace CRMSystem.Domain.Entities;

public class Meeting : TenantEntity
{
    public Guid OrganizationId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? AssignedUserId { get; set; }
    [NotMapped]
    public string? AssignedUserName { get; set; }
    public Guid? TicketId { get; set; }
    public string Subject { get; set; } = "";
    public string Description { get; set; } = "";
    public string MeetingType { get; set; } = "Online";
    public string? Location { get; set; }
    public string? OnlineLink { get; set; }
    public string? RequestedTimeWindow { get; set; }
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    public string Status { get; set; } = "Requested";
    public string? Notes { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    /// <summary>Set once this meeting has been pushed to (or pulled from) an external
    /// calendar, so the pull-sync job never re-imports a meeting the CRM itself created.</summary>
    public string? ExternalEventId { get; set; }
    public string? ExternalCalendarProvider { get; set; }
}
