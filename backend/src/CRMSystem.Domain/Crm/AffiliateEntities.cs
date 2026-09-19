namespace CRMSystem.Domain.Entities;

public static class AffiliateMarketing
{
    /// <summary>Display names for the brand-level affiliate links (/digitmak, /vezilka, /hpc, /bau).
    /// Validity of the brand itself is checked against ITenantDirectory, not this list — this
    /// only supplies a friendly name for admin screens and emails.</summary>
    public static readonly IReadOnlyDictionary<string, string> BrandNames =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["digitmak"] = "DIGITMAK",
            ["hpc"] = "HPC",
            ["vezilka"] = "VEZILKA",
            ["bau"] = "BAU",
        };

    public static string BrandName(string code) =>
        BrandNames.TryGetValue(code, out var name) ? name : code.ToUpperInvariant();

    /// <summary>Validates and normalises a specific partner's slug under a brand
    /// (e.g. the "acme-agency" in /digitmak/acme-agency). Partners are not a fixed list —
    /// any new partner works immediately as long as the slug is safe: lowercase letters,
    /// digits and hyphens, up to 64 characters. Empty/absent partner is valid (a plain
    /// brand-level link with no specific partner attached).</summary>
    public static bool TryNormalizePartnerCode(string? code, out string normalizedCode)
    {
        normalizedCode = code?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalizedCode.Length == 0)
            return true;
        var valid = normalizedCode.Length <= 64
            && normalizedCode.All(character => char.IsAsciiLetterOrDigit(character) || character == '-');
        if (!valid)
            normalizedCode = string.Empty;
        return valid;
    }
}

public class AffiliateClick : TenantEntity
{
    public string AffiliateCode { get; set; } = "";
    /// <summary>The specific partner under the brand, if the link named one (e.g. "acme-agency"
    /// in /digitmak/acme-agency). Empty for a plain brand-level link.</summary>
    public string? PartnerCode { get; set; }
    public string ClickId { get; set; } = "";
    public string LandingPath { get; set; } = "";
    /// <summary>Set once the visitor appears to have actually submitted the embedded
    /// Google Form (detected client-side by the form's iframe reloading to Google's
    /// confirmation page) — a faster, best-effort signal distinct from the authoritative
    /// lead created later by the Google Form webhook.</summary>
    public DateTimeOffset? ConvertedAt { get; set; }
    public string? Referrer { get; set; }
    public string? UserAgent { get; set; }
}

/// <summary>A registered partner under a brand (e.g. "acme-agency" under "digitmak"),
/// created by an admin before any traffic exists. This is what makes a partner's link
/// ("/digitmak/acme-agency") show up in the admin overview immediately with zero clicks,
/// rather than only appearing once someone actually visits it.</summary>
public class AffiliatePartner : Entity
{
    public string BrandCode { get; set; } = "";
    public string PartnerCode { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
    /// <summary>Optional link to the CRM organization this partner corresponds to
    /// (e.g. "bau/stopanska-komora" linked to the "Стопанска комора" organization).
    /// When set, leads arriving through this partner's link are automatically linked
    /// to that organization instead of needing a manual "Поврзи со организација" step.</summary>
    public Guid? LinkedOrganizationId { get; set; }
}
