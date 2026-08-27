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
public sealed class AdminReportExportsController(PortalDbContext db) : ControllerBase
{
    [HttpGet("export")]
    public async Task<IResult> Export(CancellationToken ct)
    {
        var rows = await db.Tickets.OrderBy(x => x.CreatedAt).ToListAsync(ct);
        return CsvFile(
            [
                "Број на тикет",
                "Категорија",
                "Приоритет",
                "Статус",
                "Организација ID",
                "Одговорно лице ID",
                "Креиран",
            ],
            rows.Select(x =>
                    (IReadOnlyList<string?>)
                        [
                            x.TicketNumber,
                            x.Category,
                            x.Priority,
                            x.Status,
                            x.OrganizationId.ToString(),
                            x.AssignedAgentId?.ToString(),
                            x.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                        ]
                )
                .ToList(),
            "crm-system-tickets.csv"
        );
    }

    [HttpGet("export/{dataset}")]
    public async Task<IResult> ExportDataset(string dataset, string? format, CancellationToken ct)
    {
        var organizations = await db.Organizations
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var users = await db.Users
            .ToDictionaryAsync(x => x.Id, x => DisplayUser(x), ct);
        string title;
        IReadOnlyList<string> headers;
        IReadOnlyList<IReadOnlyList<string?>> rows;
        switch (dataset.ToLowerInvariant())
        {
            case "contacts":
                title = "CRM System · Контакт-барања";
                headers =
                [
                    "Организација",
                    "Тип на организација",
                    "Сектор",
                    "Регион",
                    "DMA категорија",
                    "Главна потреба",
                    "Статус",
                    "Креирано",
                ];
                rows = (await db.ContactRequests.OrderBy(x => x.CreatedAt).ToListAsync(ct))
                    .Select(x =>
                        (IReadOnlyList<string?>)
                            [
                                x.OrganizationName,
                                Label(x.OrganizationType),
                                x.Sector,
                                x.Region,
                                Label(x.DmaCategory),
                                Label(x.MainNeed),
                                Label(x.Status),
                                x.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                            ]
                    )
                    .ToList();
                break;
            case "meetings":
                title = "CRM System · Состаноци";
                headers =
                [
                    "Наслов",
                    "Тип",
                    "Статус",
                    "Организација",
                    "Одговорно лице",
                    "Почеток",
                    "Креирано",
                ];
                rows = (await db.Meetings.OrderBy(x => x.CreatedAt).ToListAsync(ct))
                    .Select(x =>
                        (IReadOnlyList<string?>)
                            [
                                x.Subject,
                                Label(x.MeetingType),
                                Label(x.Status),
                                OrganizationName(organizations, x.OrganizationId),
                                UserName(users, x.AssignedUserId),
                                x.StartsAt?.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                                x.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                            ]
                    )
                    .ToList();
                break;
            case "subscriptions":
                title = "CRM System · Претплати";
                headers = ["Корисник", "Организација", "Статус", "Почеток", "Истекува", "Креирано"];
                rows = (await db.Subscriptions.OrderBy(x => x.CreatedAt).ToListAsync(ct))
                    .Select(x =>
                        (IReadOnlyList<string?>)
                            [
                                UserName(users, x.UserId),
                                OrganizationName(organizations, x.OrganizationId),
                                Label(x.Status),
                                x.StartsAt?.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                                x.ExpiresAt?.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                                x.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                            ]
                    )
                    .ToList();
                break;
            case "tickets":
                title = "CRM System · Тикети";
                headers =
                [
                    "Број на тикет",
                    "Категорија",
                    "Приоритет",
                    "Статус",
                    "Организација",
                    "Одговорно лице",
                    "Креиран",
                ];
                rows = (await db.Tickets.OrderBy(x => x.CreatedAt).ToListAsync(ct))
                    .Select(x =>
                        (IReadOnlyList<string?>)
                            [
                                x.TicketNumber,
                                Label(x.Category),
                                Label(x.Priority),
                                Label(x.Status),
                                OrganizationName(organizations, x.OrganizationId),
                                UserName(users, x.AssignedAgentId),
                                x.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm"),
                            ]
                    )
                    .ToList();
                break;
            case "crm-demand":
                title = "CRM System · Побарувачка по услуги и клиенти";
                headers = ["Клиент", "Е-пошта", "Организација", "Услуга", "CRM статус", "Креирано"];
                var demand = await db.ContactRequests.OrderBy(x => x.CreatedAt).ToListAsync(ct);
                rows = demand.SelectMany(x => { try { return System.Text.Json.JsonSerializer.Deserialize<List<ServiceName>>(x.ServiceItemsJson, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)) ?? []; } catch { return []; } }, (request, service) => (IReadOnlyList<string?>)[request.ContactName, request.Email, request.OrganizationName, service.Name, Label(request.Status), request.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm")]).ToList();
                break;
            case "crm-analytics":
                title = "CRM System · Оперативна CRM аналитика";
                headers = ["Референца", "Клиент", "Организација", "Тип барање", "CRM статус", "Услуга", "Статус услуга", "Цена", "Рок", "Одговорен агент", "Буџет", "Креирано"];
                var analytics = await db.ContactRequests.OrderBy(x => x.CreatedAt).ToListAsync(ct);
                rows = analytics.SelectMany(x => { try { return System.Text.Json.JsonSerializer.Deserialize<List<AnalyticsService>>(x.ServiceItemsJson, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)) ?? []; } catch { return []; } }, (request, service) => (IReadOnlyList<string?>)[$"CRM-{request.Id.ToString("N")[..8].ToUpperInvariant()}", request.ContactName, request.OrganizationName, Label(request.RequestType), Label(request.Status), service.Name, Label(service.Status), service.Price?.ToString("0.00"), service.Deadline?.ToLocalTime().ToString("dd.MM.yyyy"), UserName(users, service.AssignedAgentId), request.BudgetRange, request.CreatedAt.ToLocalTime().ToString("dd.MM.yyyy HH:mm")]).ToList();
                break;
            default:
                return Results.BadRequest(
                    new { message = "Unsupported report dataset." }
                );
        }
        if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            return CsvFile(headers, rows, $"crm-system-{dataset.ToLowerInvariant()}.csv");
        if (string.Equals(format, "json", StringComparison.OrdinalIgnoreCase))
        {
            var records = rows.Select(row => headers.Select((header, index) => new { header, value = index < row.Count ? row[index] : null }).ToDictionary(x => x.header, x => x.value));
            return Results.File(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(records, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }), "application/json", $"crm-system-{dataset.ToLowerInvariant()}.json");
        }

        var workbook = SpreadsheetExports.Report(title, headers, rows);
        return Results.File(
            workbook,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"crm-system-{dataset.ToLowerInvariant()}.xlsx"
        );
    }

    private static string DisplayUser(AppUser user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? user.Email ?? user.Id.ToString() : $"{name} ({user.Email})";
    }

    private static string OrganizationName(IReadOnlyDictionary<Guid, string> items, Guid? id) =>
        id is { } value && value != Guid.Empty && items.TryGetValue(value, out var name) ? name : "Без организација";

    private static string UserName(IReadOnlyDictionary<Guid, string> items, Guid? id) =>
        id is { } value && value != Guid.Empty && items.TryGetValue(value, out var name) ? name : "Недоделено";

    private static string Label(string? value) =>
        value switch
        {
            null or "" => "—",
            "SME" => "МСП",
            "Company" => "Компанија",
            "PublicInstitution" => "Јавна институција",
            "NGO" => "Невладина организација",
            "Low" => "Низок",
            "Normal" => "Нормален",
            "High" => "Висок",
            "Urgent" => "Итен",
            "New" => "Нов",
            "Applied" => "Пријавен",
            "Contacting" => "Во фаза на контактирање",
            "Assigned" => "Доделен",
            "ServicesConfirmed" => "Потврдени услуги",
            "InService" => "Во процедура на услуга",
            "FollowUp" => "Следен состанок",
            "Served" => "Услужен",
            "Resolved" => "Решен",
            "Closed" => "Затворен",
            "Requested" => "Побаран",
            "Confirmed" => "Потврден",
            "Cancelled" => "Откажан",
            "Completed" => "Завршен",
            "Online" => "Онлајн",
            "Offline" => "Во живо",
            "Hybrid" => "Хибриден",
            "Consultation" => "Консултација",
            "Partnership" => "Соработка",
            "PendingPayment" => "Се чека уплата",
            "Active" => "Активна",
            "Expired" => "Истечена",
            "DIGITAL_BUSINESS_STRATEGY" => "Дигитална деловна стратегија",
            "DIGITAL_READINESS" => "Дигитална подготвеност",
            "AI_READINESS" => "Дигитална зрелост",
            "AI_ACT_COMPLIANCE" => "Регулаторна усогласеност",
            "AI_USE_CASE" => "Паметни дигитални решенија",
            "AUTOMATION_AND_INTELLIGENCE" => "Автоматизација и интелигенција",
            "TEST_BEFORE_INVEST" => "Тестирај пред инвестиција",
            "DIGITALIZATION_ROADMAP" => "Дигитален патоказ",
            "TRAINING_AND_SKILLS" => "Обуки и вештини",
            "OTHER" => "Друго",
            _ => value.Replace("_", " "),
        };

    private sealed record ServiceName(string Name);
    private sealed record AnalyticsService(string Name, string Status, decimal? Price, DateTimeOffset? Deadline, Guid? AssignedAgentId);
}
