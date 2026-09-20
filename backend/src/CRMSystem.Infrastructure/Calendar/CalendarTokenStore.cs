using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace CRMSystem.Infrastructure.Calendar;

/// <summary>Shared OAuth token refresh logic for both push (CalendarSyncService) and pull
/// (CalendarPullSyncJob) calendar sync, so the refresh flow lives in exactly one place.</summary>
public sealed class CalendarTokenStore(
    IHttpClientFactory httpClientFactory,
    IDataProtectionProvider dataProtection,
    IConfiguration configuration)
{
    public IDataProtector Protector => dataProtection.CreateProtector("CalendarConnection.Tokens.v1");

    public async Task<string> GetValidAccessTokenAsync(CalendarConnection connection, CancellationToken ct)
    {
        if (connection.AccessTokenExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2))
            return Protector.Unprotect(connection.AccessTokenProtected);

        if (string.IsNullOrEmpty(connection.RefreshTokenProtected))
            throw new InvalidOperationException("Calendar connection expired and has no refresh token.");

        var refreshToken = Protector.Unprotect(connection.RefreshTokenProtected);
        var client = httpClientFactory.CreateClient();

        if (connection.Provider == "Google")
        {
            var response = await client.PostAsync(
                "https://oauth2.googleapis.com/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = configuration["GOOGLE_CALENDAR_CLIENT_ID"] ?? "",
                    ["client_secret"] = configuration["GOOGLE_CALENDAR_CLIENT_SECRET"] ?? "",
                    ["refresh_token"] = refreshToken,
                    ["grant_type"] = "refresh_token",
                }),
                ct);
            response.EnsureSuccessStatusCode();
            var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var newAccessToken = json.RootElement.GetProperty("access_token").GetString()!;
            var expiresIn = json.RootElement.GetProperty("expires_in").GetInt32();
            connection.AccessTokenProtected = Protector.Protect(newAccessToken);
            connection.AccessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(expiresIn);
            return newAccessToken;
        }
        else
        {
            var tenantId = configuration["MS_CALENDAR_TENANT_ID"] ?? "common";
            var response = await client.PostAsync(
                $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = configuration["MS_CALENDAR_CLIENT_ID"] ?? "",
                    ["client_secret"] = configuration["MS_CALENDAR_CLIENT_SECRET"] ?? "",
                    ["refresh_token"] = refreshToken,
                    ["grant_type"] = "refresh_token",
                    ["scope"] = "offline_access Calendars.ReadWrite",
                }),
                ct);
            response.EnsureSuccessStatusCode();
            var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var newAccessToken = json.RootElement.GetProperty("access_token").GetString()!;
            var expiresIn = json.RootElement.GetProperty("expires_in").GetInt32();
            connection.AccessTokenProtected = Protector.Protect(newAccessToken);
            connection.AccessTokenExpiresAt = DateTimeOffset.UtcNow.AddSeconds(expiresIn);
            if (json.RootElement.TryGetProperty("refresh_token", out var newRefresh))
                connection.RefreshTokenProtected = Protector.Protect(newRefresh.GetString()!);
            return newAccessToken;
        }
    }
}
