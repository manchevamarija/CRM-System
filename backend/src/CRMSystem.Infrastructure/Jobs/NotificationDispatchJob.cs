using CRMSystem.Application;
using Microsoft.EntityFrameworkCore;
using Quartz;
using CRMSystem.Infrastructure.Persistence;
using System.Text.RegularExpressions;
using CRMSystem.Application.Tenancy;

namespace CRMSystem.Application.Jobs;

/// <summary>
/// Sends queued Notification rows through IEmailSender, with exponential backoff on failure.
/// Runs every minute — this is the time-sensitive half of what used to be one big
/// NotificationWorker BackgroundService loop.
/// </summary>
[DisallowConcurrentExecution]
public sealed class NotificationDispatchJob(
    PortalDbContext db,
    IEmailSender email,
    ITenantContext tenantContext,
    ILogger<NotificationDispatchJob> logger
) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var now = DateTimeOffset.UtcNow;
        var queued = await db
            .Notifications.Where(x =>
                x.Status == "Queued" && (x.NextAttemptAt == null || x.NextAttemptAt <= now)
            )
            .OrderBy(x => x.CreatedAt)
            .Take(20)
            .ToListAsync(ct);
        foreach (var notification in queued)
        {
            var userData = notification.RecipientUserId is null
                ? null
                : await db
                    .Users.Where(x => x.Id == notification.RecipientUserId.Value)
                    .Select(x => new { x.Email, x.PreferredLanguage })
                    .SingleOrDefaultAsync(ct);
            var address = notification.RecipientEmail ?? userData?.Email;
            if (address is null)
            {
                notification.Status = "Failed";
                notification.LastError = "Recipient not found";
                continue;
            }
            try
            {
                var rendered = EmailTemplates.Render(
                    notification.Type,
                    notification.Language ?? userData?.PreferredLanguage,
                    notification.Subject,
                    notification.Body,
                    tenantContext.Current.Name
                );
                var attachment = ExtractAttachment(rendered.Body, out var cleanBody);
                if (attachment is null)
                    await email.SendAsync(address, rendered.Subject, cleanBody, ct);
                else
                    await email.SendAsync(address, rendered.Subject, cleanBody, attachment, ct);
                notification.Status = "Sent";
                notification.SentAt = DateTimeOffset.UtcNow;
                notification.LastError = null;
                if (notification.Type == "AdminUserCreated")
                    notification.Body = "<p>The temporary credentials were delivered by email.</p>";
            }
            catch (Exception ex)
            {
                notification.AttemptCount++;
                notification.LastError = ex.Message[..Math.Min(ex.Message.Length, 500)];
                if (notification.AttemptCount >= 5)
                    notification.Status = "Failed";
                else
                    notification.NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(
                        Math.Pow(2, notification.AttemptCount)
                    );
                logger.LogWarning(
                    ex,
                    "Email delivery deferred (attempt {Attempt})",
                    notification.AttemptCount
                );
            }
        }
        await db.SaveChangesAsync(ct);
    }

    private static EmailAttachment? ExtractAttachment(string body, out string cleanBody)
    {
        var match = Regex.Match(body, "<!--CRM_ATTACHMENT:([^:]+):([^:]+):([A-Za-z0-9+/=]+)-->");
        cleanBody = match.Success ? body.Replace(match.Value, "") : body;
        if (!match.Success) return null;
        try { return new EmailAttachment(match.Groups[1].Value, match.Groups[2].Value, Convert.FromBase64String(match.Groups[3].Value)); }
        catch (FormatException) { return null; }
    }
}
