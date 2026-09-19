using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;

namespace CRMSystem.Infrastructure.Calendar;

/// <summary>
/// Pushes confirmed CRM meetings into whichever calendar (Google or Microsoft) the
/// assigned staff member has connected. The client's email is added as an attendee, so
/// Google/Microsoft handle sending the actual invitation — the CRM never sends its own
/// calendar-invite email for this. The created event's id is stored back on the meeting so
/// the pull-sync job (CalendarPullSyncJob) never re-imports it as a "new" external event.
/// </summary>
public sealed class CalendarSyncService(
    PortalDbContext db,
    IHttpClientFactory httpClientFactory,
    CalendarTokenStore tokenStore,
    ILogger<CalendarSyncService> logger) : ICalendarSyncService
{
    public async Task PushMeetingAsync(Guid meetingId, CancellationToken ct)
    {
        var meeting = await db.Meetings.FindAsync([meetingId], ct);
        if (meeting is null || meeting.StartsAt is null || meeting.AssignedUserId is null)
            return;

        var connection = await db.CalendarConnections
            .FirstOrDefaultAsync(x => x.UserId == meeting.AssignedUserId, ct);
        if (connection is null)
            return; // This staff member hasn't connected a calendar — nothing to do.

        var attendeeEmail = await db.Users
            .Where(x => x.Id == meeting.RequestedByUserId)
            .Select(x => x.Email)
            .FirstOrDefaultAsync(ct);

        try
        {
            var accessToken = await tokenStore.GetValidAccessTokenAsync(connection, ct);
            var externalEventId = connection.Provider == "Google"
                ? await PushToGoogleAsync(accessToken, meeting, attendeeEmail, ct)
                : await PushToMicrosoftAsync(accessToken, meeting, attendeeEmail, ct);

            meeting.ExternalEventId = externalEventId;
            meeting.ExternalCalendarProvider = connection.Provider;
            connection.LastSyncedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // A calendar push failure must never block confirming the meeting in the CRM
            // itself — the meeting stays confirmed either way, just without an external
            // calendar entry this time.
            logger.LogWarning(ex, "Calendar push failed for meeting {MeetingId}", meetingId);
        }
    }

    private async Task<string> PushToGoogleAsync(string accessToken, Meeting meeting, string? attendeeEmail, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var body = new
        {
            summary = meeting.Subject,
            description = meeting.Description,
            location = meeting.MeetingType == "Online" ? meeting.OnlineLink : meeting.Location,
            start = new { dateTime = meeting.StartsAt!.Value.UtcDateTime.ToString("o"), timeZone = "UTC" },
            end = new { dateTime = (meeting.EndsAt ?? meeting.StartsAt.Value.AddHours(1)).UtcDateTime.ToString("o"), timeZone = "UTC" },
            attendees = string.IsNullOrWhiteSpace(attendeeEmail)
                ? Array.Empty<object>()
                : new object[] { new { email = attendeeEmail } },
        };
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await client.PostAsync(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
            content, ct);
        response.EnsureSuccessStatusCode();
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return json.RootElement.GetProperty("id").GetString()!;
    }

    private async Task<string> PushToMicrosoftAsync(string accessToken, Meeting meeting, string? attendeeEmail, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var body = new
        {
            subject = meeting.Subject,
            body = new { contentType = "Text", content = meeting.Description },
            location = new { displayName = meeting.MeetingType == "Online" ? meeting.OnlineLink ?? "Online" : meeting.Location ?? "" },
            start = new { dateTime = meeting.StartsAt!.Value.UtcDateTime.ToString("o"), timeZone = "UTC" },
            end = new { dateTime = (meeting.EndsAt ?? meeting.StartsAt.Value.AddHours(1)).UtcDateTime.ToString("o"), timeZone = "UTC" },
            attendees = string.IsNullOrWhiteSpace(attendeeEmail)
                ? Array.Empty<object>()
                : new object[] { new { emailAddress = new { address = attendeeEmail }, type = "required" } },
        };
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("https://graph.microsoft.com/v1.0/me/events", content, ct);
        response.EnsureSuccessStatusCode();
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return json.RootElement.GetProperty("id").GetString()!;
    }
}
