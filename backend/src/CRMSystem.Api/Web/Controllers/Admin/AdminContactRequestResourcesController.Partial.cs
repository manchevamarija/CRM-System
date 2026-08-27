using System.Text.Json;
using CRMSystem.Application;
using CRMSystem.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;

namespace CRMSystem.Api.Web.Controllers.Admin;

public sealed partial class AdminContactRequestsController
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpPatch("contact-requests/{id:guid}/services/{serviceId:guid}")]
    public async Task<IResult> UpdateService(Guid id, Guid serviceId, ContactServiceItemUpdateRequest request)
    {
        var item = await FindOwnedAsync(id);
        if (item is null) return Results.NotFound();
        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        var index = services.FindIndex(service => service.Id == serviceId);
        if (index < 0) return Results.NotFound();
        var previous = services[index];
        services[index] = services[index] with { Status = request.Status, Price = request.Price, Deadline = request.Deadline, AssignedAgentId = request.AssignedAgentId };
        item.ServiceItemsJson = JsonSerializer.Serialize(services, JsonOptions);
        item.Status = services.Count > 0 && services.All(service => service.Status == "Completed")
            ? "Served"
            : services.Any(service => service.Status == "InProgress" || service.Status == "FollowUp")
                ? "InService"
                : services.Count > 0 && services.All(service => service.Status is "Confirmed" or "Completed")
                    ? "ServicesConfirmed"
                    : services.Any(service => service.AssignedAgentId is not null) ? "Assigned" : item.Status;
        db.Notifications.Add(new Notification
        {
            RecipientUserId = item.UserId,
            RecipientEmail = item.Email,
            Type = "CrmServiceUpdated",
            Subject = $"Ажурирана услуга: {services[index].Name}",
            Body = $"<p>Услугата <strong>{System.Net.WebUtility.HtmlEncode(services[index].Name)}</strong> е ажурирана. Статус: {System.Net.WebUtility.HtmlEncode(request.Status)}.</p>" + ((previous.Price != request.Price || (previous.Status != "Confirmed" && request.Status == "Confirmed")) ? ContactRequestService.BuildPdfAttachment(item, services.Select(service => $"{service.Name} · {StatusLabel(service.Status)}{(service.Price is null ? "" : $" · {service.Price:0.00} €")}"), "CRM-azurirana-potvrda", true, tenantContext.Current.Name) : ""),
            ActionUrl = "/portal?tab=crm",
        });
        await db.SaveChangesAsync();
        if (item.UserId is { } userId) await crmHub.Clients.User(userId.ToString()).SendAsync("CrmUpdated", new { item.Id, serviceId });
        return Results.Ok(item);
    }

    [HttpPost("contact-requests/{id:guid}/services")]
    public async Task<IResult> AddService(Guid id, AddContactServiceRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return Results.BadRequest(new { message = "Service name is required." });
        var item = await FindOwnedAsync(id);
        if (item is null) return Results.NotFound();
        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        if (services.Any(service => service.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
            return Results.Conflict(new { message = "This service is already part of the request." });
        var service = new CrmServiceItem(Guid.NewGuid(), name, "Selected", null, null, null, services.Count);
        services.Add(service);
        item.ServiceItemsJson = JsonSerializer.Serialize(services, JsonOptions);
        item.SelectedServices = JsonSerializer.Serialize(services.Select(x => x.Name));
        db.Notifications.Add(new Notification { RecipientUserId = item.UserId, RecipientEmail = item.Email, Language = item.PreferredLanguage, Type = "CrmServiceAdded", Subject = $"Додадена услуга: {name}", Body = $"<p>Во барањето е додадена услугата <strong>{System.Net.WebUtility.HtmlEncode(name)}</strong>.</p>" + ContactRequestService.BuildPdfAttachment(item, services.Select(service => $"{service.Name} · {StatusLabel(service.Status)}"), "CRM-azurirana-potvrda", true, tenantContext.Current.Name), ActionUrl = "/portal?tab=crm" });
        db.AuditLogs.Add(Audit(User, "ContactRequestServiceAdded", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        if (item.UserId is { } userId) await crmHub.Clients.User(userId.ToString()).SendAsync("CrmUpdated", new { RequestId = item.Id, ServiceId = service.Id });
        return Results.Ok(item);
    }

    [HttpDelete("contact-requests/{id:guid}/services/{serviceId:guid}")]
    public async Task<IResult> RemoveService(Guid id, Guid serviceId)
    {
        var item = await FindOwnedAsync(id);
        if (item is null) return Results.NotFound();
        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        var removed = services.FirstOrDefault(service => service.Id == serviceId);
        if (removed is null) return Results.NotFound();
        services.Remove(removed);
        item.ServiceItemsJson = JsonSerializer.Serialize(services.Select((service, index) => service with { Order = index }), JsonOptions);
        item.SelectedServices = JsonSerializer.Serialize(services.Select(service => service.Name));
        db.Notifications.Add(new Notification { RecipientUserId = item.UserId, RecipientEmail = item.Email, Language = item.PreferredLanguage, Type = "CrmServiceRemoved", Subject = $"Отстранета услуга: {removed.Name}", Body = $"<p>Услугата <strong>{System.Net.WebUtility.HtmlEncode(removed.Name)}</strong> е отстранета од барањето.</p>" + ContactRequestService.BuildPdfAttachment(item, services.Select(service => $"{service.Name} · {StatusLabel(service.Status)}"), "CRM-azurirana-potvrda", true, tenantContext.Current.Name), ActionUrl = "/portal?tab=crm" });
        db.AuditLogs.Add(Audit(User, "ContactRequestServiceRemoved", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        if (item.UserId is { } userId) await crmHub.Clients.User(userId.ToString()).SendAsync("CrmUpdated", new { RequestId = item.Id, ServiceId = serviceId });
        return Results.NoContent();
    }

    [HttpGet("contact-requests/{id:guid}/attachments")]
    public async Task<IResult> GetAttachments(Guid id, CancellationToken ct)
    {
        if (await FindVisibleAsync(id) is null) return Results.NotFound();
        var items = await db.ContactRequestAttachments.Where(x => x.ContactRequestId == id)
            .Join(db.Files, attachment => attachment.FileId, file => file.Id, (attachment, file) => new
            {
                attachment.Id,
                attachment.ContactRequestId,
                attachment.FileId,
                attachment.UploadedBy,
                attachment.CreatedAt,
                file.OriginalFilename,
                file.ContentType,
                file.SizeBytes,
            }).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Results.Ok(items);
    }

    [HttpPost("contact-requests/{id:guid}/attachments")]
    public async Task<IResult> UploadAttachment(Guid id, IFormFile file, CancellationToken ct)
    {
        if (await FindOwnedAsync(id) is null) return Results.NotFound();
        try
        {
            var stored = await storage.SaveAsync(file, nameof(ContactRequest), id, User.UserId(), ct);
            var attachment = new ContactRequestAttachment { ContactRequestId = id, FileId = stored.Id, UploadedBy = User.UserId() };
            db.ContactRequestAttachments.Add(attachment);
            db.AuditLogs.Add(Audit(User, "ContactRequestAttachmentUploaded", nameof(ContactRequestAttachment), attachment.Id));
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/admin/contact-requests/{id}/attachments/{attachment.Id}", new { attachment.Id, attachment.FileId, stored.OriginalFilename, stored.ContentType, stored.SizeBytes });
        }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { message = ex.Message }); }
    }

    private static string StatusLabel(string status) => status switch
    {
        "Applied" => "Пријавен",
        "Contacting" => "Во фаза на контактирање",
        "Assigned" => "Доделен на агент од CRM System",
        "ServicesConfirmed" => "Потврдени услуги",
        "InService" => "Во процедура на услуга",
        "FollowUp" => "Follow up",
        "Served" => "Услужен",
        _ => status,
    };

    private sealed record CrmServiceItem(Guid Id, string Name, string Status, decimal? Price, DateTimeOffset? Deadline, Guid? AssignedAgentId, int Order);
    public sealed record AddContactServiceRequest(string Name);
}
