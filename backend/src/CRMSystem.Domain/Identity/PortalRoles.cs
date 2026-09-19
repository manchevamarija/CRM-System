namespace CRMSystem.Domain.Entities;

public static class PortalRoles
{
    public const string PlatformAdmin = "PlatformAdmin";
    public const string Admin = "Admin";
    public const string HelpDeskAgent = "HelpDeskAgent";
    public const string Expert = "Expert";
    public const string Client = "Client";

    public static readonly string[] TenantStaff = [Admin, HelpDeskAgent, Expert];
    public static readonly string[] Seeded = [PlatformAdmin, Admin, HelpDeskAgent, Expert, Client];
}
