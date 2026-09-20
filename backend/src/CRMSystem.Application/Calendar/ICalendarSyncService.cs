namespace CRMSystem.Application;

public interface ICalendarSyncService
{
    /// <summary>Pushes a confirmed meeting to the assigned staff member's connected
    /// calendar (Google or Microsoft), with the requesting client added as an attendee so
    /// the calendar provider sends them an invitation email. No-ops silently if that staff
    /// member has no connected calendar, or the meeting has no confirmed time yet.</summary>
    Task PushMeetingAsync(Guid meetingId, CancellationToken ct);

    /// <summary>Removes a previously-pushed meeting from the assigned staff member's
    /// connected calendar (call this when a meeting is cancelled or rejected). No-ops
    /// silently if the meeting was never pushed, or the connection is gone.</summary>
    Task DeleteExternalEventAsync(Guid meetingId, CancellationToken ct);
}
