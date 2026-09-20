using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Quartz;
using CRMSystem.Infrastructure.Persistence;

namespace CRMSystem.Infrastructure.Calendar;

/// <summary>
/// Reads each connected staff calendar (Google/Microsoft) for events in the next 30 days
/// and either links them to an existing meeting, matches them to a known CRM contact, or —
/// if none of the attendees are recognised — files them in UnmatchedCalendarEvent for an
/// admin to resolve manually. See docs/calendar-sync.md for the full design and why
/// unmatched attendees are never auto-assigned to an organization.
///
/// Events the CRM itself pushed (Meeting.ExternalEventId already set) are skipped, so a
/// meeting confirmed in the CRM is never re-imported as if it were new.
/// </summary>
[DisallowConcurrentExecution]
public sealed class CalendarPullSyncJob(
    PortalDbContext db,
    IHttpClientFactory httpClientFactory,
    CalendarTokenStore tokenStore,
    ILogger<CalendarPullSyncJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var connections = await db.CalendarConnections.ToListAsync(ct);
        foreach (var connection in connections)
        {
            try
            {
                var accessToken = await tokenStore.GetValidAccessTokenAsync(connection, ct);
                var events = connection.Provider == "Google"
                    ? await ListGoogleEventsAsync(accessToken, ct)
                    : await ListMicrosoftEventsAsync(accessToken, ct);

                foreach (var (externalId, subject, description, startsAt, endsAt, attendeeEmails) in events)
                    await ReconcileEventAsync(connection, externalId, subject, startsAt, endsAt, attendeeEmails, ct);

                connection.LastSyncedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Calendar pull sync failed for connection {Id}", connection.Id);
            }
        }
    }

    private async Task ReconcileEventAsync(
        CalendarConnection connection,
        string externalId,
        string subject,
        DateTimeOffset? startsAt,
        DateTimeOffset? endsAt,
        List<string> attendeeEmails,
        CancellationToken ct)
    {
        // Already ours — either we pushed it (stage 1) or we've already pulled it before.
        var alreadyLinked = await db.Meetings.AnyAsync(x => x.ExternalEventId == externalId, ct);
        if (alreadyLinked)
            return;

        var existingUnmatched = await db.UnmatchedCalendarEvents
            .FirstOrDefaultAsync(x => x.CalendarConnectionId == connection.Id && x.ExternalEventId == externalId, ct);
        // An admin already made a decision about this one — never resurrect it.
        if (existingUnmatched is { Status: "Resolved" or "Ignored" })
            return;

        // Check every attendee, not just the first — a meeting with several external
        // guests should still match if any one of them is a known CRM contact.
        AppUser? matchedUser = null;
        if (attendeeEmails.Count > 0)
        {
            var candidates = await db.Users
                .Where(x => attendeeEmails.Contains(x.Email!) && x.OrganizationId != null)
                .ToListAsync(ct);
            // Prefer whichever candidate appears first in the event's own attendee order.
            matchedUser = attendeeEmails
                .Select(email => candidates.FirstOrDefault(x => x.Email == email))
                .FirstOrDefault(x => x is not null);
        }

        if (matchedUser is not null)
        {
            db.Meetings.Add(new Meeting
            {
                OrganizationId = matchedUser.OrganizationId!.Value,
                RequestedByUserId = matchedUser.Id,
                AssignedUserId = connection.UserId,
                Subject = subject,
                Description = "",
                MeetingType = "Online",
                StartsAt = startsAt,
                EndsAt = endsAt,
                Status = "Confirmed",
                ConfirmedAt = DateTimeOffset.UtcNow,
                ExternalEventId = externalId,
                ExternalCalendarProvider = connection.Provider,
            });
            // If this attendee had previously been queued as unmatched (e.g. their account
            // was created after the event first appeared), that queue entry is now moot.
            if (existingUnmatched is not null)
                db.UnmatchedCalendarEvents.Remove(existingUnmatched);
            return;
        }

        var representativeEmail = attendeeEmails.FirstOrDefault();
        if (existingUnmatched is null)
        {
            db.UnmatchedCalendarEvents.Add(new UnmatchedCalendarEvent
            {
                CalendarConnectionId = connection.Id,
                ExternalEventId = externalId,
                Subject = subject,
                AttendeeEmail = representativeEmail,
                StartsAt = startsAt,
                EndsAt = endsAt,
                Status = "Pending",
            });
        }
        else
        {
            existingUnmatched.Subject = subject;
            existingUnmatched.StartsAt = startsAt;
            existingUnmatched.EndsAt = endsAt;
        }
    }

    private async Task<List<(string Id, string Subject, string Description, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, List<string> AttendeeEmails)>>
        ListGoogleEventsAsync(string accessToken, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var timeMin = Uri.EscapeDataString(DateTimeOffset.UtcNow.ToString("o"));
        var timeMax = Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(30).ToString("o"));
        var response = await client.GetAsync(
            $"https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={timeMin}&timeMax={timeMax}&singleEvents=true&orderBy=startTime",
            ct);
        if (!response.IsSuccessStatusCode)
            return [];

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var results = new List<(string, string, string, DateTimeOffset?, DateTimeOffset?, List<string>)>();
        if (!json.RootElement.TryGetProperty("items", out var items))
            return results;

        foreach (var item in items.EnumerateArray())
        {
            var id = item.GetProperty("id").GetString() ?? "";
            var subject = item.TryGetProperty("summary", out var s) ? s.GetString() ?? "" : "";
            var description = item.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            var startsAt = ParseGoogleDateTime(item, "start");
            var endsAt = ParseGoogleDateTime(item, "end");
            var attendeeEmails = new List<string>();
            if (item.TryGetProperty("attendees", out var attendees))
            {
                foreach (var attendee in attendees.EnumerateArray())
                {
                    var isSelf = attendee.TryGetProperty("self", out var selfFlag) && selfFlag.GetBoolean();
                    if (isSelf) continue;
                    var email = attendee.TryGetProperty("email", out var e) ? e.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(email)) attendeeEmails.Add(email);
                }
            }
            results.Add((id, subject, description, startsAt, endsAt, attendeeEmails));
        }
        return results;
    }

    private static DateTimeOffset? ParseGoogleDateTime(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var node)) return null;
        if (node.TryGetProperty("dateTime", out var dateTime) && DateTimeOffset.TryParse(dateTime.GetString(), out var parsed))
            return parsed;
        return null;
    }

    private async Task<List<(string Id, string Subject, string Description, DateTimeOffset? StartsAt, DateTimeOffset? EndsAt, List<string> AttendeeEmails)>>
        ListMicrosoftEventsAsync(string accessToken, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        // Ask Microsoft Graph to return every date/time already converted to UTC, instead
        // of parsing each event's own declared time zone ourselves.
        client.DefaultRequestHeaders.Add("Prefer", "outlook.timezone=\"UTC\"");
        var start = Uri.EscapeDataString(DateTimeOffset.UtcNow.ToString("o"));
        var end = Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(30).ToString("o"));
        var response = await client.GetAsync(
            $"https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start}&endDateTime={end}",
            ct);
        if (!response.IsSuccessStatusCode)
            return [];

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var results = new List<(string, string, string, DateTimeOffset?, DateTimeOffset?, List<string>)>();
        if (!json.RootElement.TryGetProperty("value", out var items))
            return results;

        foreach (var item in items.EnumerateArray())
        {
            var id = item.GetProperty("id").GetString() ?? "";
            var subject = item.TryGetProperty("subject", out var s) ? s.GetString() ?? "" : "";
            var description = item.TryGetProperty("bodyPreview", out var d) ? d.GetString() ?? "" : "";
            var startsAt = ParseMicrosoftDateTime(item, "start");
            var endsAt = ParseMicrosoftDateTime(item, "end");
            var attendeeEmails = new List<string>();
            if (item.TryGetProperty("attendees", out var attendees))
            {
                foreach (var attendee in attendees.EnumerateArray())
                {
                    if (!attendee.TryGetProperty("emailAddress", out var emailAddress)) continue;
                    var address = emailAddress.TryGetProperty("address", out var addressNode) ? addressNode.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(address)) attendeeEmails.Add(address);
                }
            }
            results.Add((id, subject, description, startsAt, endsAt, attendeeEmails));
        }
        return results;
    }

    private static DateTimeOffset? ParseMicrosoftDateTime(JsonElement item, string property)
    {
        if (!item.TryGetProperty(property, out var node)) return null;
        if (node.TryGetProperty("dateTime", out var dateTime) && DateTime.TryParse(dateTime.GetString(), out var parsed))
            // The request sends "Prefer: outlook.timezone=\"UTC\"", so Graph has already
            // converted this to UTC before we ever see it — no local-timezone guessing.
            return new DateTimeOffset(DateTime.SpecifyKind(parsed, DateTimeKind.Utc));
        return null;
    }
}
