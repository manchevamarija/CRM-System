namespace CRMSystem.Domain.Entities;

/// <summary>A staff member's link to their own Google or Microsoft calendar. One row per
/// person per provider. Tokens are stored protected (ASP.NET Data Protection), never in
/// plain text.</summary>
public class CalendarConnection : Entity
{
    public Guid UserId { get; set; }
    /// <summary>"Google" or "Microsoft".</summary>
    public string Provider { get; set; } = "";
    public string ConnectedEmail { get; set; } = "";
    public string AccessTokenProtected { get; set; } = "";
    public string? RefreshTokenProtected { get; set; }
    public DateTimeOffset AccessTokenExpiresAt { get; set; }
    public DateTimeOffset? LastSyncedAt { get; set; }
}

/// <summary>An external calendar event (found while reading a connected staff calendar)
/// whose attendee email did not match any known CRM contact. Held here for an admin to
/// resolve manually — see docs/calendar-sync.md. Populated by the pull-sync job (stage 2).</summary>
public class UnmatchedCalendarEvent : Entity
{
    public Guid CalendarConnectionId { get; set; }
    public string ExternalEventId { get; set; } = "";
    public string Subject { get; set; } = "";
    public string? AttendeeEmail { get; set; }
    public DateTimeOffset? StartsAt { get; set; }
    public DateTimeOffset? EndsAt { get; set; }
    /// <summary>"Pending", "Resolved", or "Ignored".</summary>
    public string Status { get; set; } = "Pending";
    public Guid? ResolvedOrganizationId { get; set; }
}
