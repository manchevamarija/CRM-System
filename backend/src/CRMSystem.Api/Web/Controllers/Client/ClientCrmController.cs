using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using CRMSystem.Application.Realtime;

namespace CRMSystem.Api.Web.Controllers.Client;

[ApiController]
[Route("api/crm")]
[Authorize]
public sealed class ClientCrmController(PortalDbContext db, IHubContext<CrmHub> crmHub) : ControllerBase
{
    [HttpGet("my-requests")]
    public async Task<IResult> MyRequests(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Results.Unauthorized();
        var email = User.FindFirstValue(ClaimTypes.Email) ?? "";
        var unlinked = await db.ContactRequests
            .Where(item => item.UserId == null && item.Email.ToLower() == email.ToLower())
            .ToListAsync(ct);
        if (unlinked.Count > 0)
        {
            foreach (var item in unlinked) item.UserId = userId;
            await db.SaveChangesAsync(ct);
        }
        var items = await db.ContactRequests
            .Where(item => item.UserId == userId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(ct);
        var normalized = false;
        foreach (var item in items)
        {
            var next = item.Status switch
            {
                "New" => "Applied",
                "Responded" => "Contacting",
                "RegistrationInvited" => "Contacting",
                "Handled" => "Served",
                _ => item.Status,
            };
            if (next == item.Status) continue;
            item.Status = next;
            normalized = true;
        }
        if (normalized) await db.SaveChangesAsync(ct);
        return Results.Ok(items);
    }

    [HttpPost("my-requests/{id:guid}/services")]
    public async Task<IResult> AddService(Guid id, AddServiceRequest request, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)) return Results.Unauthorized();
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return Results.BadRequest(new { message = "Service name is required." });
        var item = await db.ContactRequests.SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
        if (item is null) return Results.NotFound();
        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        if (services.Any(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase))) return Results.Conflict(new { message = "Service already added." });
        services.Add(new CrmServiceItem(Guid.NewGuid(), name, "Selected", null, null, null, services.Count));
        item.ServiceItemsJson = JsonSerializer.Serialize(services, JsonOptions);
        item.SelectedServices = JsonSerializer.Serialize(services.Select(x => x.Name));
        var admins = await db.UserRoles.Join(db.Roles.Where(r => r.Name == "Admin"), ur => ur.RoleId, r => r.Id, (ur, _) => ur.UserId).ToListAsync(ct);
        foreach (var adminId in admins) db.Notifications.Add(new Notification { RecipientUserId = adminId, Type = "ClientCrmServiceAdded", Subject = $"Клиент додаде услуга: {name}", Body = $"<p>{item.ContactName} додаде <strong>{System.Net.WebUtility.HtmlEncode(name)}</strong> во барањето CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}.</p>", ActionUrl = "/admin?tab=contacts" });
        await db.SaveChangesAsync(ct);
        await crmHub.Clients.User(userId.ToString()).SendAsync("CrmUpdated", new { item.Id }, ct);
        return Results.Ok(item);
    }

    [HttpDelete("my-requests/{id:guid}/services/{serviceId:guid}")]
    public async Task<IResult> RemoveService(Guid id, Guid serviceId, CancellationToken ct)
    {
        await Task.CompletedTask;
        return Results.Forbid();
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private sealed record CrmServiceItem(Guid Id, string Name, string Status, decimal? Price, DateTimeOffset? Deadline, Guid? AssignedAgentId, int Order);
    public sealed record AddServiceRequest(string Name);
}
