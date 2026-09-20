namespace CRMSystem.Domain.Entities;

public class ServiceCatalogueItem : TenantEntity
{
    public string Slug { get; set; } = "";
    public string Status { get; set; } = "Published";
    public string Category { get; set; } = "General";
}

public class ContentPage : TenantEntity
{
    public string Slug { get; set; } = "";
    public string Status { get; set; } = "Draft";
}

public class Translation : TenantEntity
{
    public string EntityType { get; set; } = "";
    public Guid EntityId { get; set; }
    public string Language { get; set; } = "mk";
    public string FieldName { get; set; } = "";
    public string Value { get; set; } = "";
}

public class EvidenceFile : TenantEntity
{
    public string RelatedEntityType { get; set; } = "";
    public Guid RelatedEntityId { get; set; }
    public Guid FileId { get; set; }
    public string? KpiCategory { get; set; }
    public string? ReportingPeriod { get; set; }
    public string? TemplateType { get; set; }
    public Guid CreatedBy { get; set; }
}

public class EvidenceTemplate : TenantEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string RelatedEntityType { get; set; } = "Ticket";
    public string Description { get; set; } = "";
    public string RequiredMetadataJson { get; set; } = "[]";
    public bool IsActive { get; set; } = true;
}

public class SystemSetting : TenantEntity
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public string? Description { get; set; }
}
