namespace CRMSystem.Application;

public interface IEmailSender
{
    Task SendAsync(string recipient, string subject, string body, CancellationToken ct);
    Task SendAsync(string recipient, string subject, string body, EmailAttachment attachment, CancellationToken ct);
}

public sealed record EmailAttachment(string FileName, string ContentType, byte[] Content);
