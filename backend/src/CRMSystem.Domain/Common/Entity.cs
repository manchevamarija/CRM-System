namespace CRMSystem.Domain.Entities;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Marks data that belongs to exactly one CRM centre in the shared database.
/// The infrastructure layer assigns and protects this value automatically.
/// </summary>
public interface ITenantOwned
{
    string TenantId { get; set; }
}

public abstract class TenantEntity : Entity, ITenantOwned
{
    public string TenantId { get; set; } = "crm";
}
