using CRMSystem.Application.Tenancy;

namespace CRMSystem.Infrastructure.Tenancy;

/// <summary>
/// Transitional tenant resolver for single-brand deployments. Replace this implementation
/// with a verified host/token resolver when all brands start sharing one database.
/// </summary>
public sealed class ConfigurationTenantContext(IConfiguration configuration) : ITenantContext
{
    public TenantDescriptor Current { get; } = new(
        NormalizeId(configuration["Brand:Id"]),
        Value(configuration["Brand:Name"], "CRM System"),
        Value(configuration["Brand:LegalName"], "CRM System"),
        Value(configuration["Brand:SupportEmail"], "support@crmsystem.mk"),
        Value(configuration["Brand:PrimaryColor"], "#174e63"),
        Value(configuration["Brand:AccentColor"], "#d9951e")
    );

    private static string Value(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static string NormalizeId(string? value)
    {
        var id = Value(value, "crm").ToLowerInvariant();
        return id.All(character => char.IsAsciiLetterOrDigit(character) || character == '-')
            ? id
            : throw new InvalidOperationException("Brand:Id may contain only letters, digits and hyphens.");
    }
}

/// <summary>
/// Shared directory of centres participating in the CRM. Values can be replaced from
/// Tenancy:Tenants configuration without coupling the handover workflow to a brand.
/// </summary>
public sealed class ConfigurationTenantDirectory(IConfiguration configuration) : ITenantDirectory
{
    private static readonly TenantDescriptor[] Defaults =
    [
        new("digitmak", "DIGITMAK", "DIGITMAK", "support@digitmak.mk", "#174e63", "#d9951e"),
        new("vezilka", "VEZILKA", "VEZILKA", "support@vezilka.mk", "#174e63", "#d9951e"),
        new("hpc", "HPC", "HPC.mk", "support@hpc.mk", "#174e63", "#d9951e"),
        new("bau", "BAU", "Business Accelerator UKIM", "support@bau.mk", "#174e63", "#d9951e"),
    ];

    public IReadOnlyList<TenantDescriptor> All { get; } = Load(configuration);

    public TenantDescriptor? Find(string id) =>
        All.FirstOrDefault(item => item.Id.Equals(id?.Trim(), StringComparison.OrdinalIgnoreCase));

    private static IReadOnlyList<TenantDescriptor> Load(IConfiguration configuration)
    {
        var configured = configuration.GetSection("Tenancy:Tenants").Get<TenantDescriptor[]>();
        return configured is { Length: > 0 } ? configured : Defaults;
    }
}
