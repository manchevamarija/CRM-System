using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Api.Web.Controllers.Client;

/// <summary>
/// Helpers shared across the client-facing controllers (profile, organizations,
/// subscriptions, account-change-requests, meetings) — mirrors the private
/// static helpers that used to live at the bottom of the old ClientEndpoints.cs.
/// </summary>
internal static class ClientSupport
{
    internal static AuditLog Audit(
        ClaimsPrincipal principal,
        string action,
        string entityType,
        Guid id,
        string? metadata = null
    ) =>
        new()
        {
            ActorUserId = principal.UserId(),
            Action = action,
            EntityType = entityType,
            EntityId = id.ToString(),
            MetadataJson = metadata,
        };

    internal static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    internal static bool CalendarProviderConfigured(IConfiguration config, string prefix) =>
        !string.IsNullOrWhiteSpace(config[$"{prefix}_CLIENT_ID"])
        && !string.IsNullOrWhiteSpace(config[$"{prefix}_CLIENT_SECRET"])
        && Uri.TryCreate(config[$"{prefix}_REDIRECT_URI"], UriKind.Absolute, out _);

    internal static string SignIntegrationState(string payload, string key)
    {
        var encoded = Convert
            .ToBase64String(Encoding.UTF8.GetBytes(payload))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var signature = Convert
            .ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(encoded)))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        return $"{encoded}.{signature}";
    }

    /// <summary>
    /// Queues one Notification per tenant staff user — used for events a client triggers that
    /// the centre team needs to act on (someone requesting to join an organization, an account
    /// change request, etc.). ActionUrl lets the notification bell jump straight to the right
    /// screen instead of staff having to go hunting for the record.
    /// </summary>
    internal static async Task NotifyAdminsAsync(
        PortalDbContext db,
        string type,
        string subject,
        string body,
        string? actionUrl,
        CancellationToken ct = default
    )
    {
        var adminIds = await TenantStaffUserIdsAsync(db, ct);
        foreach (var adminId in adminIds)
            db.Notifications.Add(
                new Notification
                {
                    RecipientUserId = adminId,
                    Type = type,
                    Subject = subject,
                    Body = body,
                    ActionUrl = actionUrl,
                }
            );
    }

    internal static async Task<IReadOnlyList<Guid>> TenantStaffUserIdsAsync(
        PortalDbContext db,
        CancellationToken ct = default
    ) => await StaffNotificationRecipients.GetAsync(db, ct);
}
