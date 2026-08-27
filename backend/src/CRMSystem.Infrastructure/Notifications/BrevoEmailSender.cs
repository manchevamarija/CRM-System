using System.Net;
using System.Net.Mail;
using CRMSystem.Application.Tenancy;

namespace CRMSystem.Application;

public class BrevoEmailSender(IConfiguration config, ITenantContext tenantContext, ILogger<BrevoEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(string recipient, string subject, string body, CancellationToken ct)
        => await SendCoreAsync(recipient, subject, body, null, ct);

    public async Task SendAsync(string recipient, string subject, string body, EmailAttachment attachment, CancellationToken ct)
        => await SendCoreAsync(recipient, subject, body, attachment, ct);

    private async Task SendCoreAsync(string recipient, string subject, string body, EmailAttachment? attachment, CancellationToken ct)
    {
        var host = config["BREVO_SMTP_HOST"];
        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogWarning("SMTP not configured; email retained for retry: {Subject}", subject);
            throw new InvalidOperationException("SMTP is not configured");
        }
        var useSsl = config.GetValue<bool?>("BREVO_SMTP_USE_SSL") ?? true;
        var username = config["BREVO_SMTP_USERNAME"];
        var password = config["BREVO_SMTP_PASSWORD"];
        using var client = new SmtpClient(
            host,
            int.TryParse(config["BREVO_SMTP_PORT"], out var p) ? p : 587
        )
        {
            EnableSsl = useSsl,
            UseDefaultCredentials = string.IsNullOrWhiteSpace(username),
        };
        if (!string.IsNullOrWhiteSpace(username))
            client.Credentials = new NetworkCredential(username, password);
        using var message = new MailMessage(
            new MailAddress(
                config["BREVO_FROM_EMAIL"] ?? "noreply@crmsystem.mk",
                config["BREVO_FROM_NAME"] ?? tenantContext.Current.Name
            ),
            new MailAddress(recipient)
        )
        {
            Subject = subject,
            Body = body,
            IsBodyHtml = true,
        };
        if (attachment is not null)
            message.Attachments.Add(new Attachment(new MemoryStream(attachment.Content), attachment.FileName, attachment.ContentType));
        await client.SendMailAsync(message, ct);
    }
}
