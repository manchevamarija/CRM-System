using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using CRMSystem.Application.Exports;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Policy = "Admin")]
public sealed class AdminReportsController(PortalDbContext db) : ControllerBase
{
    [HttpGet("kpis")]
    public async Task<IResult> Kpis(CancellationToken ct)
    {
        var clientRoleUserIds = db.UserRoles.Join(
            db.Roles.Where(role => role.Name == "Client"),
            userRole => userRole.RoleId,
            role => role.Id,
            (userRole, _) => userRole.UserId
        );
        var privilegedUserIds = db.UserRoles.Join(
            db.Roles.Where(role => role.Name == "Admin"),
            userRole => userRole.RoleId,
            role => role.Id,
            (userRole, _) => userRole.UserId
        );
        var clientUserIds = clientRoleUserIds.Where(userId => !privilegedUserIds.Contains(userId));
        return Results.Ok(
            new
            {
                activeSubscriptions = await db.Subscriptions.CountAsync(
                    x => x.Status == "Active" && clientUserIds.Contains(x.UserId),
                    ct
                ),
                expiredSubscriptions = await db.Subscriptions.CountAsync(
                    x =>
                        (x.Status == "Expired" || x.Status == "Cancelled")
                        && clientUserIds.Contains(x.UserId),
                    ct
                ),
                aiHelpDeskSubscriptions = await db.Subscriptions.CountAsync(
                    x => clientUserIds.Contains(x.UserId),
                    ct
                ),
                tickets = await db.Tickets.CountAsync(ct),
                newTickets = await db.Tickets.CountAsync(x => x.Status == "New", ct),
                meetings = await db.Meetings.CountAsync(ct),
                confirmedMeetings = await db.Meetings.CountAsync(x => x.Status == "Confirmed", ct),
                contactRequests = await db.ContactRequests.CountAsync(ct),
                publicInstitutions = await db.Organizations.CountAsync(
                    x => x.Type == "PublicInstitution" && x.Status == "Approved",
                    ct
                ),
                aiActRequests = await db.Tickets.CountAsync(x => x.Category == "AI_ACT_COMPLIANCE", ct),
                referrals = await db.Tickets.CountAsync(x => x.ReferralRecommendation != null, ct),
                repeatClients = await db.ContactRequests.GroupBy(x => x.Email.ToLower()).CountAsync(x => x.Count() > 1, ct),
            }
        );
    }

    [HttpGet("crm-demand")]
    public async Task<IResult> CrmDemand(CancellationToken ct)
    {
        var requests = await db.ContactRequests.Select(x => new { x.Email, x.ContactName, x.OrganizationName, x.ServiceItemsJson }).ToListAsync(ct);
        var services = requests.SelectMany(request =>
        {
            try { return System.Text.Json.JsonSerializer.Deserialize<List<ServiceName>>(request.ServiceItemsJson, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)) ?? []; }
            catch { return []; }
        }).GroupBy(x => x.Name).Select(x => new { key = x.Key, count = x.Count() }).OrderByDescending(x => x.count).Take(10);
        var clients = requests.GroupBy(x => new { Email = x.Email.ToLower(), x.ContactName, x.OrganizationName }).Select(x => new { key = $"{x.Key.ContactName} · {x.Key.OrganizationName}", count = x.Count() }).OrderByDescending(x => x.count).Take(10);
        return Results.Ok(new { byService = services, byClient = clients });
    }

    private sealed record ServiceName(string Name);

    [HttpGet("crm-analytics")]
    public async Task<IResult> CrmAnalytics(CancellationToken ct)
    {
        var requests = await db.ContactRequests.OrderBy(x => x.CreatedAt).ToListAsync(ct);
        var serviceRows = requests.SelectMany(request => ParseServices(request.ServiceItemsJson).Select(service => new { Request = request, Service = service })).ToList();
        var now = DateTimeOffset.UtcNow;
        var completedRequests = requests.Count(x => x.Status == "Served");
        var quoted = serviceRows.Where(x => x.Service.Price is not null).Select(x => x.Service.Price!.Value).ToList();
        return Results.Ok(new
        {
            byMonth = requests.GroupBy(x => x.CreatedAt.ToString("yyyy-MM")).Select(x => new { key = x.Key, count = x.Count() }).OrderBy(x => x.key),
            byCrmStage = requests.GroupBy(x => x.Status).Select(x => new { key = x.Key, count = x.Count() }).OrderByDescending(x => x.count),
            byRequestType = requests.GroupBy(x => x.RequestType).Select(x => new { key = x.Key, count = x.Count() }).OrderByDescending(x => x.count),
            byBudget = requests.GroupBy(x => string.IsNullOrWhiteSpace(x.BudgetRange) ? "Unspecified" : x.BudgetRange).Select(x => new { key = x.Key, count = x.Count() }).OrderByDescending(x => x.count),
            byServiceStatus = serviceRows.GroupBy(x => x.Service.Status).Select(x => new { key = x.Key, count = x.Count() }).OrderByDescending(x => x.count),
            byAgent = serviceRows.GroupBy(x => x.Service.AssignedAgentId).Select(x => new { key = x.Key?.ToString() ?? "Unassigned", count = x.Count() }).OrderByDescending(x => x.count),
            overdueServices = serviceRows.Count(x => x.Service.Deadline < now && x.Service.Status != "Completed"),
            upcomingDeadlines = serviceRows.Count(x => x.Service.Deadline >= now && x.Service.Deadline <= now.AddDays(30) && x.Service.Status != "Completed"),
            totalQuotedValue = quoted.Sum(),
            averageServiceValue = quoted.Count == 0 ? 0 : quoted.Average(),
            conversionRate = requests.Count == 0 ? 0 : Math.Round((decimal)completedRequests / requests.Count * 100, 1),
            completionRate = serviceRows.Count == 0 ? 0 : Math.Round((decimal)serviceRows.Count(x => x.Service.Status == "Completed") / serviceRows.Count * 100, 1),
        });
    }

    private static List<AnalyticsService> ParseServices(string json)
    {
        try { return System.Text.Json.JsonSerializer.Deserialize<List<AnalyticsService>>(json, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)) ?? []; }
        catch { return []; }
    }
    private sealed record AnalyticsService(string Name, string Status, decimal? Price, DateTimeOffset? Deadline, Guid? AssignedAgentId);

    [HttpGet("subscriptions")]
    public async Task<object> Subscriptions(CancellationToken ct)
    {
        var clientRoleUserIds = db.UserRoles.Join(
            db.Roles.Where(role => role.Name == "Client"),
            userRole => userRole.RoleId,
            role => role.Id,
            (userRole, _) => userRole.UserId
        );
        var privilegedUserIds = db.UserRoles.Join(
            db.Roles.Where(role => role.Name == "Admin"),
            userRole => userRole.RoleId,
            role => role.Id,
            (userRole, _) => userRole.UserId
        );
        var clientUserIds = clientRoleUserIds.Where(userId => !privilegedUserIds.Contains(userId));
        return await db
            .Subscriptions.Where(item => clientUserIds.Contains(item.UserId))
            .GroupBy(x => x.Status)
            .Select(x => new { status = x.Key, count = x.Count() })
            .ToListAsync(ct);
    }

    [HttpGet("tickets")]
    public async Task<object> Tickets(CancellationToken ct) =>
        await db
            .Tickets.GroupBy(x => new { x.Status, x.Category })
            .Select(x => new
            {
                x.Key.Status,
                x.Key.Category,
                count = x.Count(),
            })
            .ToListAsync(ct);

    [HttpGet("contacts")]
    public async Task<IResult> Contacts(CancellationToken ct) =>
        Results.Ok(
            new
            {
                byOrganizationType = await db
                    .ContactRequests.GroupBy(x => x.OrganizationType)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                bySector = await db
                    .ContactRequests.GroupBy(x => x.Sector ?? "Unspecified")
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byRegion = await db
                    .ContactRequests.GroupBy(x => x.Region ?? "Unspecified")
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byNeed = await db
                    .ContactRequests.GroupBy(x => x.MainNeed)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byDmaCategory = await db
                    .ContactRequests.GroupBy(x => x.DmaCategory)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
            }
        );

    [HttpGet("tickets-detailed")]
    public async Task<IResult> TicketsDetailed(CancellationToken ct) =>
        Results.Ok(
            new
            {
                byCategory = await db
                    .Tickets.GroupBy(x => x.Category)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byStatus = await db
                    .Tickets.GroupBy(x => x.Status)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byAssignee = await db
                    .Tickets.GroupBy(x => x.AssignedAgentId)
                    .Select(x => new
                    {
                        key = x.Key == null ? "Unassigned" : x.Key.ToString(),
                        count = x.Count(),
                    })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byOrganizationType = await db
                    .Tickets.Join(
                        db.Organizations,
                        ticket => ticket.OrganizationId,
                        organization => organization.Id,
                        (ticket, organization) => organization.Type
                    )
                    .GroupBy(x => x)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
            }
        );

    [HttpGet("meetings")]
    public async Task<IResult> Meetings(CancellationToken ct) =>
        Results.Ok(
            new
            {
                byStatus = await db
                    .Meetings.GroupBy(x => x.Status)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
                byType = await db
                    .Meetings.GroupBy(x => x.MeetingType)
                    .Select(x => new { key = x.Key, count = x.Count() })
                    .OrderByDescending(x => x.count)
                    .ToListAsync(ct),
            }
        );

    [HttpGet("referrals")]
    public async Task<object> Referrals(CancellationToken ct) =>
        await db
            .Tickets.Where(x => x.ReferralRecommendation != null && x.ReferralRecommendation != "")
            .GroupBy(x => x.ReferralRecommendation!)
            .Select(x => new { key = x.Key, count = x.Count() })
            .OrderByDescending(x => x.count)
            .ToListAsync(ct);

}
