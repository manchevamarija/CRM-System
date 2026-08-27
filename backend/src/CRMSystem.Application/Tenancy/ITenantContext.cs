namespace CRMSystem.Application.Tenancy;

/// <summary>
/// Identifies the organisation whose data and branding are active for the current operation.
/// Today it is populated from deployment configuration. A future shared-database deployment
/// can replace the resolver without changing application services.
/// </summary>
public interface ITenantContext
{
    TenantDescriptor Current { get; }
}

public interface ITenantDirectory
{
    IReadOnlyList<TenantDescriptor> All { get; }
    TenantDescriptor? Find(string id);
}

public sealed record TenantDescriptor(
    string Id,
    string Name,
    string LegalName,
    string SupportEmail,
    string PrimaryColor,
    string AccentColor
);
