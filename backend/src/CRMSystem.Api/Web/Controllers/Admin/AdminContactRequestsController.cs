using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using static CRMSystem.Api.Web.Controllers.Admin.AdminSupport;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using CRMSystem.Application.Realtime;
using CRMSystem.Infrastructure.Services;
using CRMSystem.Application.Tenancy;

namespace CRMSystem.Api.Web.Controllers.Admin;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "Admin")]
public sealed partial class AdminContactRequestsController(PortalDbContext db, IConfiguration config, ITenantContext tenantContext, ITenantDirectory tenantDirectory, IHubContext<CrmHub> crmHub, IFileStorage storage)
    : ControllerBase
{
    private static readonly string[] CrmStatuses =
    [
        "Applied",
        "Contacting",
        "Assigned",
        "ServicesConfirmed",
        "InService",
        "FollowUp",
        "Served",
    ];
    [HttpGet("contact-requests")]
    public async Task<IReadOnlyList<ContactRequest>> Get(
        int? page,
        int? pageSize,
        string? status,
        CancellationToken ct
    ) =>
        await db
            .ContactRequests.Where(x =>
                (x.CreatedTenantId == tenantContext.Current.Id || x.OwnerTenantId == tenantContext.Current.Id)
                && (status == null || x.Status == status))
            .OrderByDescending(x => x.CreatedAt)
            .Skip(Offset(page, pageSize))
            .Take(Size(pageSize))
            .ToListAsync(ct);

    [HttpGet("ticket-attachments")]
    public async Task<object> GetTicketAttachments(CancellationToken ct)
    {
        var ticketAttachments = await (
            from attachment in db.TicketAttachments
            join file in db.Files on attachment.FileId equals file.Id
            join ticket in db.Tickets on attachment.TicketId equals ticket.Id
            join organization in db.Organizations on ticket.OrganizationId equals organization.Id into organizations
            from organization in organizations.DefaultIfEmpty()
            orderby attachment.CreatedAt descending
            select new
            {
                attachment.Id,
                attachment.TicketId,
                attachment.MessageId,
                attachment.FileId,
                attachment.UploadedBy,
                attachment.CreatedAt,
                file.OriginalFilename,
                file.ContentType,
                file.SizeBytes,
                file.Checksum,
                ticket.TicketNumber,
                TicketTitle = ticket.Title,
                OrganizationName = organization == null ? "Без организација" : organization.Name,
                SourceType = "Тикет",
            }).ToListAsync(ct);

        var contactRows = await (
            from attachment in db.ContactRequestAttachments
            join file in db.Files on attachment.FileId equals file.Id
            join request in db.ContactRequests on attachment.ContactRequestId equals request.Id
            orderby attachment.CreatedAt descending
            select new
            {
                attachment.Id,
                RequestId = request.Id,
                MessageId = (Guid?)null,
                attachment.FileId,
                attachment.UploadedBy,
                attachment.CreatedAt,
                file.OriginalFilename,
                file.ContentType,
                file.SizeBytes,
                file.Checksum,
                TicketTitle = request.ContactName,
                OrganizationName = string.IsNullOrWhiteSpace(request.OrganizationName)
                    ? "Без организација"
                    : request.OrganizationName,
            }).ToListAsync(ct);

        var contactRequestAttachments = contactRows.Select(item => new
        {
            item.Id,
            TicketId = item.RequestId,
            item.MessageId,
            item.FileId,
            item.UploadedBy,
            item.CreatedAt,
            item.OriginalFilename,
            item.ContentType,
            item.SizeBytes,
            item.Checksum,
            TicketNumber = $"CRM-{item.RequestId.ToString("N")[..8].ToUpperInvariant()}",
            item.TicketTitle,
            item.OrganizationName,
            SourceType = "Контакт барање",
        });

        return ticketAttachments
            .Concat(contactRequestAttachments)
            .OrderByDescending(x => x.CreatedAt)
            .ToList();
    }

    [HttpGet("contact-requests/tenants")]
    public IResult GetTenants() => Results.Ok(tenantDirectory.All);

    [HttpGet("contact-requests/{id:guid}")]
    public async Task<IResult> GetOne(Guid id)
    {
        var item = await FindVisibleAsync(id);
        return item is null ? Results.NotFound() : Results.Ok(item);
    }

    [HttpGet("contact-requests/{id:guid}/transfers")]
    public async Task<IResult> GetTransfers(Guid id, CancellationToken ct)
    {
        if (await FindVisibleAsync(id) is null) return Results.NotFound();
        return Results.Ok(await db.ContactRequestTransfers.AsNoTracking()
            .Where(item => item.ContactRequestId == id)
            .OrderByDescending(item => item.TransferredAt)
            .ToListAsync(ct));
    }

    [HttpGet("contact-requests/{id:guid}/confirmation-pdf")]
    public async Task<IResult> GetConfirmationPdf(Guid id, CancellationToken ct)
    {
        var item = await FindVisibleAsync(id);
        if (item is null) return Results.NotFound();
        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        var latestTransfer = await db.ContactRequestTransfers.AsNoTracking()
            .Where(transfer => transfer.ContactRequestId == id)
            .OrderByDescending(transfer => transfer.TransferredAt)
            .FirstOrDefaultAsync(ct);
        var ownerName = tenantDirectory.Find(item.OwnerTenantId)?.Name ?? item.OwnerTenantId;
        var bytes = latestTransfer is null
            ? ContactRequestService.BuildCurrentPdfBytes(item, services.Select(service => service.Name), ownerName)
            : ContactRequestService.BuildHandoverPdfBytes(
                item,
                services.Select(service => service.Name),
                tenantDirectory.Find(latestTransfer.FromTenantId)?.Name ?? latestTransfer.FromTenantId,
                ownerName,
                latestTransfer.Reason);
        return Results.File(bytes, "application/pdf", $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}-potvrda.pdf");
    }

    [HttpPatch("contact-requests/{id:guid}")]
    public async Task<IResult> Update(Guid id, ContactUpdateRequest request)
    {
        var principal = User;
        var item = await FindOwnedAsync(id);
        if (item is null)
            return Results.NotFound(new { message = "The request is read-only because another centre is responsible for it." });
        if (
            request.DmaCategory is not null
            && !DmaCategoryMapping.IsValid(request.DmaCategory)
        )
            return Results.BadRequest(new { message = "Unsupported internal DMA category." });
        if (!CrmStatuses.Contains(request.Status, StringComparer.Ordinal))
            return Results.BadRequest(new { message = "Unsupported CRM status." });
        item.Status = request.Status;
        item.AssignedTo = request.AssignedTo;
        item.LinkedOrganizationId = request.LinkedOrganizationId;
        item.DmaCategory = request.DmaCategory ?? item.DmaCategory;
        item.InternalNote = request.InternalNote ?? item.InternalNote;
        if (item.UserId is null)
            item.UserId = await db.Users.Where(user => user.Email != null && user.Email.ToLower() == item.Email.ToLower()).Select(user => (Guid?)user.Id).FirstOrDefaultAsync();
        db.Notifications.Add(new Notification
        {
            RecipientUserId = item.UserId,
            RecipientEmail = item.Email,
            Language = item.PreferredLanguage,
            Type = "CrmStatusChanged",
            Subject = $"{tenantContext.Current.Name} статус: {StatusLabel(item.Status)}",
            Body = $"<p>Статусот на вашето барање е променет во <strong>{StatusLabel(item.Status)}</strong>.</p><p>Најавете се во порталот за целосен преглед.</p>",
            ActionUrl = "/portal?tab=crm",
        });
        db.AuditLogs.Add(Audit(principal, "ContactRequestUpdated", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        if (item.UserId is { } userId)
            await crmHub.Clients.User(userId.ToString()).SendAsync("CrmUpdated", new { item.Id, item.Status });
        return Results.Ok(item);
    }

    [HttpPost("contact-requests/{id:guid}/assign")]
    public async Task<IResult> Assign(Guid id, ContactAssignmentRequest request)
    {
        var item = await FindOwnedAsync(id);
        if (item is null)
            return Results.NotFound();

        item.AssignedTo = request.AgentId;
        item.AssignedHelpDeskAdvisorId = request.HelpDeskAdvisorId;
        item.AssignedExpertId = request.ExpertId;
        item.Status = "Assigned";
        item.UserId ??= await db.Users.Where(user => user.Email != null && user.Email.ToLower() == item.Email.ToLower()).Select(user => (Guid?)user.Id).FirstOrDefaultAsync();
        db.Notifications.Add(StatusEmail(item, "Assigned"));
        db.AuditLogs.Add(Audit(User, "ContactRequestAssigned", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        if (item.UserId is { } clientId)
            await crmHub.Clients.User(clientId.ToString()).SendAsync("CrmUpdated", new { item.Id, item.Status });
        return Results.Ok(item);
    }

    [HttpPost("contact-requests/{id:guid}/mark-handled")]
    public async Task<IResult> MarkHandled(Guid id)
    {
        var item = await FindOwnedAsync(id);
        if (item is null)
            return Results.NotFound();

        item.Status = "Served";
        db.Notifications.Add(StatusEmail(item, "Handled"));
        db.AuditLogs.Add(Audit(User, "ContactRequestHandled", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    [HttpPost("contact-requests/{id:guid}/link-organization")]
    public async Task<IResult> LinkOrganization(Guid id, Guid organizationId)
    {
        var item = await FindOwnedAsync(id);
        if (item is null) return Results.NotFound();
        if (!await db.Organizations.AnyAsync(x => x.Id == organizationId && x.Status == "Approved"))
            return Results.BadRequest(new { message = "Select an approved organisation." });
        item.LinkedOrganizationId = organizationId;
        db.AuditLogs.Add(Audit(User, "ContactRequestLinked", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    [HttpPost("contact-requests/{id:guid}/transfer")]
    public async Task<IResult> Transfer(Guid id, ContactRequestTransferRequest request, CancellationToken ct)
    {
        var item = await FindOwnedAsync(id);
        if (item is null)
            return Results.NotFound(new { message = "Only the currently responsible centre can hand over this request." });

        var destination = tenantDirectory.Find(request.DestinationTenantId);
        if (destination is null)
            return Results.BadRequest(new { message = "Unknown destination centre." });
        if (destination.Id.Equals(item.OwnerTenantId, StringComparison.OrdinalIgnoreCase))
            return Results.Conflict(new { message = "This centre is already responsible for the request." });

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            return Results.BadRequest(new { message = "A handover reason is required." });

        var fromId = item.OwnerTenantId;
        var from = tenantDirectory.Find(fromId);
        var transfer = new ContactRequestTransfer
        {
            ContactRequestId = item.Id,
            FromTenantId = fromId,
            ToTenantId = destination.Id,
            Reason = reason,
            ServiceSnapshotJson = item.ServiceItemsJson,
            TransferredBy = User.UserId(),
        };

        item.OwnerTenantId = destination.Id;
        item.OwnershipTransferredAt = transfer.TransferredAt;
        item.AssignedTo = null;
        item.AssignedHelpDeskAdvisorId = null;
        item.AssignedExpertId = null;

        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        db.ContactRequestTransfers.Add(transfer);
        db.Notifications.Add(new Notification
        {
            RecipientUserId = item.UserId,
            RecipientEmail = item.Email,
            Language = item.PreferredLanguage,
            Type = "ContactRequestTransferred",
            Subject = ContactRequestService.HandoverSubject(item.PreferredLanguage, destination.Name, Reference(item)),
            Body = ContactRequestService.BuildHandoverBody(
                item,
                services.Select(service => service.Name),
                from?.Name ?? fromId,
                destination.Name,
                reason),
            ActionUrl = "/portal?tab=crm",
        });
        db.AuditLogs.Add(Audit(User, $"ContactRequestTransferred:{fromId}->{destination.Id}", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync(ct);
        if (item.UserId is { } userId)
            await crmHub.Clients.User(userId.ToString()).SendAsync("CrmUpdated", new { item.Id, item.Status, item.OwnerTenantId }, ct);
        return Results.Ok(item);
    }

    [HttpPost("contact-requests/{id:guid}/respond")]
    public async Task<IResult> Respond(Guid id, MessageRequest request)
    {
        var principal = User;
        var item = await FindOwnedAsync(id);
        if (item is null)
            return Results.NotFound();
        db.Notifications.Add(
            new Notification
            {
                RecipientEmail = item.Email,
                Language = item.PreferredLanguage,
                Type = "ContactRequestResponse",
                Subject = ResponseSubject(item.PreferredLanguage),
                Body = ResponseBody(item.PreferredLanguage, request.Body),
            }
        );
        // Sending a reply is an activity; it must not replace the seven-stage CRM status.
        db.AuditLogs.Add(Audit(principal, "ContactRequestResponded", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync();
        return Results.Accepted();
    }

    [HttpPost("contact-requests/{id:guid}/invite-registration")]
    public async Task<IResult> InviteRegistration(Guid id)
    {
        var principal = User;
        var item = await FindOwnedAsync(id);
        if (item is null)
            return Results.NotFound();
        var root = (config["APP_PUBLIC_URL"] ?? "http://localhost:5173").TrimEnd('/');
        db.Notifications.Add(
            new Notification
            {
                RecipientEmail = item.Email,
                Language = item.PreferredLanguage,
                Type = "RegistrationInvitation",
                Subject = $"Join {tenantContext.Current.Name}",
                Body = $"<p><a href=\"{root}/register\">Create your {System.Net.WebUtility.HtmlEncode(tenantContext.Current.Name)} account</a></p>",
            }
        );
        // Registration invitation is an activity; it must not replace the CRM status.
        db.AuditLogs.Add(
            Audit(principal, "ContactRegistrationInvited", nameof(ContactRequest), item.Id)
        );
        await db.SaveChangesAsync();
        return Results.Accepted();
    }
    private static Notification StatusEmail(ContactRequest item, string status)
    {
        var language = item.PreferredLanguage?.ToLowerInvariant() ?? "mk";
        var isHandled = status == "Handled";
        var subject = language switch
        {
            "en" => isHandled
                ? "Your CRM System contact request has been processed"
                : "Your CRM System contact request is being processed",
            "sq" => isHandled
                ? "Kërkesa juaj e kontaktit në CRM System është përpunuar"
                : "Kërkesa juaj e kontaktit në CRM System është në përpunim",
            _ => isHandled
                ? "Вашето контакт барање до CRM System е обработено"
                : "Вашето контакт барање до CRM System е во обработка",
        };
        var body = language switch
        {
            "en" => isHandled
                ? "<p>Status: <strong>Processed</strong>.</p><p>Your contact request has been completed. If an additional answer or next step is needed, our team will send it to this email address.</p>"
                : "<p>Status: <strong>In processing</strong>.</p><p>A member of the CRM System team has started reviewing your contact request.</p>",
            "sq" => isHandled
                ? "<p>Statusi: <strong>E përpunuar</strong>.</p><p>Kërkesa juaj e kontaktit është përfunduar. Nëse nevojitet përgjigje ose hap tjetër, ekipi ynë do ta dërgojë në këtë adresë emaili.</p>"
                : "<p>Statusi: <strong>Në përpunim</strong>.</p><p>Një anëtar i ekipit CRM System ka filluar shqyrtimin e kërkesës suaj.</p>",
            _ => isHandled
                ? "<p>Статус: <strong>Обработено</strong>.</p><p>Вашето контакт барање е завршено. Доколку има дополнителен одговор или следен чекор, нашиот тим ќе го испрати на оваа е-пошта.</p>"
                : "<p>Статус: <strong>Во обработка</strong>.</p><p>Член од тимот на CRM System започна со разгледување на вашето контакт барање.</p>",
        };
        return new Notification
        {
            RecipientEmail = item.Email,
            Language = language,
            Type = $"ContactRequest{status}",
            Subject = subject,
            Body = body,
        };
    }

    private static string ResponseSubject(string? language) =>
        language?.ToLowerInvariant() switch
        {
            "en" => "CRM System response to your contact request",
            "sq" => "Përgjigje nga CRM System për kërkesën tuaj",
            _ => "Одговор од CRM System за вашето контакт барање",
        };

    private static string ResponseBody(string? language, string response)
    {
        var encoded = System.Net.WebUtility.HtmlEncode(response);
        var status = language?.ToLowerInvariant() switch
        {
            "en" => "<p>Status: <strong>Processed – response sent</strong>.</p>",
            "sq" => "<p>Statusi: <strong>E përpunuar – përgjigjja u dërgua</strong>.</p>",
            _ => "<p>Статус: <strong>Обработено – испратен одговор</strong>.</p>",
        };
        return $"{status}<p>{encoded}</p>";
    }

    private Task<ContactRequest?> FindVisibleAsync(Guid id) => db.ContactRequests.FirstOrDefaultAsync(item =>
        item.Id == id && (item.CreatedTenantId == tenantContext.Current.Id || item.OwnerTenantId == tenantContext.Current.Id));

    private Task<ContactRequest?> FindOwnedAsync(Guid id) => db.ContactRequests.FirstOrDefaultAsync(item =>
        item.Id == id && item.OwnerTenantId == tenantContext.Current.Id);

    private static string Reference(ContactRequest item) =>
        $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}";

}
