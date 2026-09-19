using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;

namespace CRMSystem.Api.Web.Controllers.Staff;

/// <summary>
/// Lets a staff member connect their own Google or Microsoft calendar so confirmed
/// meetings push there automatically (see CalendarSyncService). The "connect" endpoint is
/// a normal authenticated action the frontend links to (with the JWT passed as
/// ?access_token=... since this is a full-page redirect, not a fetch call — see the
/// OnMessageReceived handler in DependencyInjection.cs). The "callback" endpoint is hit by
/// Google/Microsoft directly with no auth header at all, so who it's for travels in the
/// signed/encrypted "state" parameter instead.
/// </summary>
[ApiController]
[Route("api/staff/calendar")]
public sealed class StaffCalendarConnectionController(
    PortalDbContext db,
    IHttpClientFactory httpClientFactory,
    IDataProtectionProvider dataProtection,
    IConfiguration configuration) : ControllerBase
{
    private IDataProtector StateProtector => dataProtection.CreateProtector("CalendarConnection.OAuthState.v1");
    private IDataProtector TokenProtector => dataProtection.CreateProtector("CalendarConnection.Tokens.v1");

    [HttpGet("status")]
    [Authorize(Policy = "Staff")]
    public async Task<IResult> Status(CancellationToken ct)
    {
        var userId = User.UserId();
        var connections = await db.CalendarConnections
            .Where(x => x.UserId == userId)
            .Select(x => new { x.Provider, x.ConnectedEmail, x.LastSyncedAt })
            .ToListAsync(ct);
        return Results.Ok(connections);
    }

    [HttpPost("disconnect/{provider}")]
    [Authorize(Policy = "Staff")]
    public async Task<IResult> Disconnect(string provider, CancellationToken ct)
    {
        var userId = User.UserId();
        var connection = await db.CalendarConnections
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Provider == provider, ct);
        if (connection is null)
            return Results.NotFound();
        db.CalendarConnections.Remove(connection);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    [HttpGet("connect/{provider}")]
    [Authorize(Policy = "Staff")]
    public IResult Connect(string provider)
    {
        var userId = User.UserId();
        var appUrl = configuration["APP_PUBLIC_URL"]?.TrimEnd('/') ?? "";
        var state = StateProtector.Protect($"{userId}|{provider}|{DateTimeOffset.UtcNow.Ticks}");

        string authorizeUrl;
        if (provider == "google")
        {
            var redirectUri = $"{appUrl}/api/staff/calendar/callback/google";
            authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth"
                + $"?client_id={Uri.EscapeDataString(configuration["GOOGLE_CALENDAR_CLIENT_ID"] ?? "")}"
                + $"&redirect_uri={Uri.EscapeDataString(redirectUri)}"
                + "&response_type=code"
                + $"&scope={Uri.EscapeDataString("https://www.googleapis.com/auth/calendar.events")}"
                + "&access_type=offline&prompt=consent"
                + $"&state={Uri.EscapeDataString(state)}";
        }
        else if (provider == "microsoft")
        {
            var tenantId = configuration["MS_CALENDAR_TENANT_ID"] ?? "common";
            var redirectUri = $"{appUrl}/api/staff/calendar/callback/microsoft";
            authorizeUrl = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize"
                + $"?client_id={Uri.EscapeDataString(configuration["MS_CALENDAR_CLIENT_ID"] ?? "")}"
                + $"&redirect_uri={Uri.EscapeDataString(redirectUri)}"
                + "&response_type=code"
                + $"&scope={Uri.EscapeDataString("offline_access Calendars.ReadWrite")}"
                + $"&state={Uri.EscapeDataString(state)}";
        }
        else
        {
            return Results.BadRequest(new { message = "Unknown provider." });
        }

        return Results.Redirect(authorizeUrl);
    }

    [HttpGet("callback/google")]
    public async Task<IResult> GoogleCallback(string code, string state, CancellationToken ct)
    {
        var (userId, provider) = ParseState(state);
        if (userId is null || provider != "google")
            return Results.BadRequest(new { message = "Invalid or expired connection attempt." });

        var appUrl = configuration["APP_PUBLIC_URL"]?.TrimEnd('/') ?? "";
        var client = httpClientFactory.CreateClient();
        var response = await client.PostAsync(
            "https://oauth2.googleapis.com/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = configuration["GOOGLE_CALENDAR_CLIENT_ID"] ?? "",
                ["client_secret"] = configuration["GOOGLE_CALENDAR_CLIENT_SECRET"] ?? "",
                ["code"] = code,
                ["redirect_uri"] = $"{appUrl}/api/staff/calendar/callback/google",
                ["grant_type"] = "authorization_code",
            }), ct);
        if (!response.IsSuccessStatusCode)
            return Results.Redirect($"{appUrl}/admin?tab=meetings&calendarError=1");

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct)).RootElement;
        var accessToken = json.GetProperty("access_token").GetString()!;
        var refreshToken = json.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = json.GetProperty("expires_in").GetInt32();

        // The connected email comes from Google's userinfo endpoint — not strictly needed
        // for the sync to function, only shown to the staff member so they can see which
        // account they connected.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var connectedEmail = "";
        try
        {
            var infoResponse = await client.GetAsync("https://www.googleapis.com/oauth2/v2/userinfo", ct);
            if (infoResponse.IsSuccessStatusCode)
            {
                var info = JsonDocument.Parse(await infoResponse.Content.ReadAsStringAsync(ct)).RootElement;
                connectedEmail = info.TryGetProperty("email", out var email) ? email.GetString() ?? "" : "";
            }
        }
        catch { /* Non-critical — the connection still works without a display email. */ }

        await UpsertConnectionAsync(userId.Value, "Google", connectedEmail, accessToken, refreshToken, expiresIn, ct);
        return Results.Redirect($"{appUrl}/admin?tab=meetings&calendarConnected=google");
    }

    [HttpGet("callback/microsoft")]
    public async Task<IResult> MicrosoftCallback(string code, string state, CancellationToken ct)
    {
        var (userId, provider) = ParseState(state);
        if (userId is null || provider != "microsoft")
            return Results.BadRequest(new { message = "Invalid or expired connection attempt." });

        var appUrl = configuration["APP_PUBLIC_URL"]?.TrimEnd('/') ?? "";
        var tenantId = configuration["MS_CALENDAR_TENANT_ID"] ?? "common";
        var client = httpClientFactory.CreateClient();
        var response = await client.PostAsync(
            $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = configuration["MS_CALENDAR_CLIENT_ID"] ?? "",
                ["client_secret"] = configuration["MS_CALENDAR_CLIENT_SECRET"] ?? "",
                ["code"] = code,
                ["redirect_uri"] = $"{appUrl}/api/staff/calendar/callback/microsoft",
                ["grant_type"] = "authorization_code",
                ["scope"] = "offline_access Calendars.ReadWrite",
            }), ct);
        if (!response.IsSuccessStatusCode)
            return Results.Redirect($"{appUrl}/admin?tab=meetings&calendarError=1");

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct)).RootElement;
        var accessToken = json.GetProperty("access_token").GetString()!;
        var refreshToken = json.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = json.GetProperty("expires_in").GetInt32();

        var connectedEmail = "";
        try
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var infoResponse = await client.GetAsync("https://graph.microsoft.com/v1.0/me", ct);
            if (infoResponse.IsSuccessStatusCode)
            {
                var info = JsonDocument.Parse(await infoResponse.Content.ReadAsStringAsync(ct)).RootElement;
                connectedEmail = info.TryGetProperty("mail", out var mail) ? mail.GetString() ?? "" : "";
            }
        }
        catch { /* Non-critical. */ }

        await UpsertConnectionAsync(userId.Value, "Microsoft", connectedEmail, accessToken, refreshToken, expiresIn, ct);
        return Results.Redirect($"{appUrl}/admin?tab=meetings&calendarConnected=microsoft");
    }

    private async Task UpsertConnectionAsync(
        Guid userId, string provider, string connectedEmail,
        string accessToken, string? refreshToken, int expiresIn, CancellationToken ct)
    {
        var connection = await db.CalendarConnections
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Provider == provider, ct);
        if (connection is null)
        {
            connection = new CalendarConnection { UserId = userId, Provider = provider };
            db.CalendarConnections.Add(connection);
        }
        connection.ConnectedEmail = connectedEmail;
        connection.AccessTokenProtected = TokenProtector.Protect(accessToken);
        connection.AccessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(expiresIn);
        if (!string.IsNullOrEmpty(refreshToken))
            connection.RefreshTokenProtected = TokenProtector.Protect(refreshToken);
        await db.SaveChangesAsync(ct);
    }

    private (Guid? UserId, string? Provider) ParseState(string state)
    {
        try
        {
            var decrypted = StateProtector.Unprotect(state);
            var parts = decrypted.Split('|');
            if (parts.Length != 3)
                return (null, null);
            // The state is single-use in spirit and expires after 10 minutes — long enough
            // for the consent screen, short enough that a leaked/replayed URL is useless
            // shortly after.
            var issuedAtTicks = long.Parse(parts[2]);
            if (DateTimeOffset.UtcNow.Ticks - issuedAtTicks > TimeSpan.FromMinutes(10).Ticks)
                return (null, null);
            return (Guid.Parse(parts[0]), parts[1]);
        }
        catch
        {
            return (null, null);
        }
    }
}
