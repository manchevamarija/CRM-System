namespace CRMSystem.Domain.Entities;

public class Notification : TenantEntity
{
    public Guid? RecipientUserId { get; set; }
    public string? RecipientEmail { get; set; }
    public string? Language { get; set; }
    public string Type { get; set; } = "";
    public string Channel { get; set; } = "Email";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public string Status { get; set; } = "Queued";
    public DateTimeOffset? SentAt { get; set; }
    public int AttemptCount { get; set; }
    public DateTimeOffset? NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public bool IsRead { get; set; }
    public string? ActionUrl { get; set; }
}

public class FileObject : TenantEntity
{
    public string OriginalFilename { get; set; } = "";
    public string StoredPath { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long SizeBytes { get; set; }
    public string Checksum { get; set; } = "";
    public string Visibility { get; set; } = "Private";
    public Guid UploadedBy { get; set; }
    public string EntityType { get; set; } = "";
    public Guid EntityId { get; set; }
}

public class AuditLog
{
    public long Id { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? ActorIp { get; set; }
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string? OldValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public string? MetadataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string TenantId { get; set; } = "crm";
}
