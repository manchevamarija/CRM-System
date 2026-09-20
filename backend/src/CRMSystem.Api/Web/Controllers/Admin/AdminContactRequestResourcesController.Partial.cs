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
        services[index] = services[index] with
        {
            Status = request.Status,
            Price = request.Price,
            Deadline = request.Deadline,
            AssignedAgentId = request.AssignedAgentId,
            InternalNote = request.InternalNote?.Trim()
        };
        item.ServiceItemsJson = JsonSerializer.Serialize(services, JsonOptions);
        item.Status = services.Count > 0 && services.All(service => service.Status == "Completed")
            ? "Served"
            : services.Any(service => service.Status == "InProgress" || service.Status == "FollowUp")
                ? "InService"
                : services.Count > 0 && services.All(service => service.Status is "Confirmed" or "Completed")
                    ? "ServicesConfirmed"
                    : services.Any(service => service.AssignedAgentId is not null) ? "Assigned" : item.Status;
        var updatedName = System.Net.WebUtility.HtmlEncode(services[index].Name);
        var statusLabel = System.Net.WebUtility.HtmlEncode(request.Status);
        var pdfAttachment = (previous.Price != request.Price || (previous.Status != "Confirmed" && request.Status == "Confirmed"))
            ? ContactRequestService.BuildPdfAttachment(item, services.Select(service => $"{service.Name} · {StatusLabel(service.Status)}{(service.Price is null ? "" : $" · {service.Price:0.00} €")}"), "CRM-azurirana-potvrda", true, tenantContext.Current.Name)
            : "";
        var (updatedSubject, updatedBody) = item.PreferredLanguage switch
        {
            "en" => ($"Service updated: {services[index].Name}", $"<p>The service <strong>{updatedName}</strong> was updated. Status: {statusLabel}.</p>" + pdfAttachment),
            "sq" => ($"Shërbimi u përditësua: {services[index].Name}", $"<p>Shërbimi <strong>{updatedName}</strong> u përditësua. Statusi: {statusLabel}.</p>" + pdfAttachment),
            _ => ($"Ажурирана услуга: {services[index].Name}", $"<p>Услугата <strong>{updatedName}</strong> е ажурирана. Статус: {statusLabel}.</p>" + pdfAttachment),
        };
        db.Notifications.Add(new Notification
        {
            RecipientUserId = item.UserId,
            RecipientEmail = item.Email,
            Language = item.PreferredLanguage,
            Type = "CrmServiceUpdated",
            Subject = updatedSubject,
            Body = updatedBody,
            ActionUrl = "/portal?tab=crm",
        });
        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = User.UserId(),
            Action = previous.AssignedAgentId == request.AssignedAgentId
                ? "ContactRequestServiceUpdated"
                : "ContactRequestServiceAssigned",
            EntityType = "CrmServiceItem",
            EntityId = $"{item.Id}:{serviceId}",
            OldValuesJson = JsonSerializer.Serialize(previous, JsonOptions),
            NewValuesJson = JsonSerializer.Serialize(services[index], JsonOptions),
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
        var service = new CrmServiceItem(Guid.NewGuid(), name, "Selected", null, null, null, services.Count, null);
        services.Add(service);
        item.ServiceItemsJson = JsonSerializer.Serialize(services, JsonOptions);
        item.SelectedServices = JsonSerializer.Serialize(services.Select(x => x.Name));
        var addedName = System.Net.WebUtility.HtmlEncode(name);
        var addedPdf = ContactRequestService.BuildPdfAttachment(item, services.Select(service => $"{service.Name} · {StatusLabel(service.Status)}"), "CRM-azurirana-potvrda", true, tenantContext.Current.Name);
        var (addedSubject, addedBody) = item.PreferredLanguage switch
        {
            "en" => ($"Service added: {name}", $"<p>The service <strong>{addedName}</strong> was added to the request.</p>" + addedPdf),
            "sq" => ($"Shërbimi u shtua: {name}", $"<p>Shërbimi <strong>{addedName}</strong> u shtua në kërkesë.</p>" + addedPdf),
            _ => ($"Додадена услуга: {name}", $"<p>Во барањето е додадена услугата <strong>{addedName}</strong>.</p>" + addedPdf),
        };
        db.Notifications.Add(new Notification { RecipientUserId = item.UserId, RecipientEmail = item.Email, Language = item.PreferredLanguage, Type = "CrmServiceAdded", Subject = addedSubject, Body = addedBody, ActionUrl = "/portal?tab=crm" });
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
        var removedName = System.Net.WebUtility.HtmlEncode(removed.Name);
        var removedPdf = ContactRequestService.BuildPdfAttachment(item, services.Select(service => $"{service.Name} · {StatusLabel(service.Status)}"), "CRM-azurirana-potvrda", true, tenantContext.Current.Name);
        var (removedSubject, removedBody) = item.PreferredLanguage switch
        {
            "en" => ($"Service removed: {removed.Name}", $"<p>The service <strong>{removedName}</strong> was removed from the request.</p>" + removedPdf),
            "sq" => ($"Shërbimi u hoq: {removed.Name}", $"<p>Shërbimi <strong>{removedName}</strong> u hoq nga kërkesa.</p>" + removedPdf),
            _ => ($"Отстранета услуга: {removed.Name}", $"<p>Услугата <strong>{removedName}</strong> е отстранета од барањето.</p>" + removedPdf),
        };
        db.Notifications.Add(new Notification { RecipientUserId = item.UserId, RecipientEmail = item.Email, Language = item.PreferredLanguage, Type = "CrmServiceRemoved", Subject = removedSubject, Body = removedBody, ActionUrl = "/portal?tab=crm" });
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
        "Assigned" => "Доделен на агент од тимот",
        "ServicesConfirmed" => "Потврдени услуги",
        "InService" => "Во процедура на услуга",
        "FollowUp" => "Follow up",
        "Served" => "Услужен",
        _ => status,
    };

    private sealed record CrmServiceItem(Guid Id, string Name, string Status, decimal? Price, DateTimeOffset? Deadline, Guid? AssignedAgentId, int Order, string? InternalNote);
    public sealed record AddContactServiceRequest(string Name);
    public sealed record ContactServiceItemUpdateRequest(string Status, decimal? Price, DateTimeOffset? Deadline, Guid? AssignedAgentId, string? InternalNote);
}
