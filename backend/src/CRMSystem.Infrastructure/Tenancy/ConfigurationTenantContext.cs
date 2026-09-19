using CRMSystem.Application.Tenancy;

namespace CRMSystem.Infrastructure.Tenancy;

/// <summary>
/// Resolves the active tenant from the verified request host. Background work falls back to
/// the configured deployment tenant because it has no HTTP host. The host mapping is explicit
/// and can be overridden through Tenancy:Hosts:{tenantId}.
/// </summary>
public sealed class ConfigurationTenantContext(
    IConfiguration configuration,
    IHttpContextAccessor httpContextAccessor,
    ITenantDirectory tenantDirectory
) : ITenantContext
{
    public TenantDescriptor Current => ResolveCurrent();

    /// <summary>Brand used for data visibility. Platform/global admins keep the host tenant,
    /// while a scoped admin/staff account operates against its assigned brand.</summary>
    public string EffectiveTenantId =>
        IsGlobalScope
            ? Current.Id
            : ReadClaim("crm:assigned-brand") ?? Current.Id;

    public string? AssignedPartnerCode => ReadClaim("crm:assigned-partner");

    // Background jobs (Quartz) run with no HTTP request at all — there's no host to
    // resolve a brand from and no user claims to read, so they'd otherwise fall back to
    // Brand:Id and only ever see that one tenant's rows, silently missing everything
    // else (this is exactly why queued notifications for "digitmak" never got sent once
    // Brand:Id was changed to a different fallback value like "crm"). A job with no
    // request context is inherently a system-level operation, not scoped to one brand,
    // so treat that case as global scope.
    public bool IsGlobalScope =>
        httpContextAccessor.HttpContext is null
        || string.Equals(ReadClaim("crm:global-scope"), "true", StringComparison.OrdinalIgnoreCase);

    private string? ReadClaim(string type) =>
        httpContextAccessor.HttpContext?.User.FindFirst(type)?.Value?.Trim() is { Length: > 0 } value
            ? value.ToLowerInvariant()
            : null;

    private TenantDescriptor ResolveCurrent()
    {
        var host = httpContextAccessor.HttpContext?.Request.Host.Host;
        if (string.IsNullOrWhiteSpace(host))
            return ConfiguredFallback();

        var normalizedHost = host.Trim().TrimEnd('.').ToLowerInvariant();
        var matched = tenantDirectory.All.FirstOrDefault(tenant =>
            GetHosts(tenant.Id).Any(candidate =>
                HostMatches(normalizedHost, candidate)));

        if (matched is not null)
            return matched;

        if (!IsProduction(configuration))
            return ConfiguredFallback();

        throw new InvalidOperationException(
            $"Unknown CRM tenant host '{normalizedHost}'. Configure Tenancy:Hosts for this domain.");
    }

    private IReadOnlyList<string> GetHosts(string tenantId)
    {
        var configured = configuration.GetSection($"Tenancy:Hosts:{tenantId}").Get<string[]>() ?? [];
        if (configured.Length > 0)
            return configured;

        return
        [
            $"portal.{tenantId}.mk",
            $"crm.{tenantId}.mk",
            tenantId switch
            {
                "crm" => "crm.digitmak.mk",
                "bau" => "bau.edu.mk",
                "digitmak" => "digitmak.mk",
                "vezilka" => "vezilka.mk",
                "hpc" => "hpc.mk",
                _ => $"{tenantId}.mk",
            },
        ];
    }

    private static bool HostMatches(string actual, string configured)
    {
        var candidate = configured.Trim().TrimEnd('.').ToLowerInvariant();
        if (candidate.Length == 0)
            return false;
        if (candidate.StartsWith("*.", StringComparison.Ordinal))
            return actual.EndsWith(candidate[1..], StringComparison.Ordinal);
        return string.Equals(actual, candidate, StringComparison.Ordinal);
    }

    private TenantDescriptor ConfiguredFallback() =>
        tenantDirectory.Find(NormalizeId(configuration["Brand:Id"]))
        ?? new TenantDescriptor(
            NormalizeId(configuration["Brand:Id"]),
            Value(configuration["Brand:Name"], "DIGITMAK"),
            Value(configuration["Brand:LegalName"], "European Digital Innovation Hub DIGITMAK"),
            Value(configuration["Brand:SupportEmail"], "support@digitmak.mk"),
            Value(configuration["Brand:PrimaryColor"], "#174e63"),
            Value(configuration["Brand:AccentColor"], "#d9951e")
        );

    private static bool IsProduction(IConfiguration configuration) =>
        string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Production", StringComparison.OrdinalIgnoreCase);

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
