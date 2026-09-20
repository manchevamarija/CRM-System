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
    )
    {
        // Brand/partner visibility is enforced by PortalDbContext's query filters. This
        // applies equally to Google Form leads and requests created/transferred inside CRM.
        return await db.ContactRequests
            .Where(x => status == null || x.Status == status)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(Offset(page, pageSize))
            .Take(Size(pageSize))
            .ToListAsync(ct);
    }

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
        var visible = await db.ContactRequestTransfers.AnyAsync(x => x.ContactRequestId == id, ct);
        if (!visible) return Results.NotFound();
        return Results.Ok(await db.ContactRequestTransfers.AsNoTracking()
            .Where(item => item.ContactRequestId == id)
            .OrderByDescending(item => item.TransferredAt)
            .ToListAsync(ct));
    }

    [HttpGet("contact-requests/{id:guid}/activity")]
    public async Task<IResult> GetActivity(Guid id, CancellationToken ct)
    {
        if (await FindVisibleAsync(id) is null) return Results.NotFound();
        var rows = await ContactActivityRows(id, includeInternalComments: true, ct);
        return Results.Ok(rows);
    }

    [HttpPost("contact-requests/{id:guid}/internal-comments")]
    public async Task<IResult> AddInternalComment(Guid id, MessageRequest request, CancellationToken ct)
    {
        if (await FindOwnedAsync(id) is null) return Results.NotFound();
        var body = request.Body?.Trim();
        if (string.IsNullOrWhiteSpace(body))
            return Results.BadRequest(new { message = "Internal comment is required." });

        var audit = Audit(User, "ContactRequestInternalComment", nameof(ContactRequest), id);
        audit.MetadataJson = JsonSerializer.Serialize(new { body }, JsonOptions);
        db.AuditLogs.Add(audit);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/admin/contact-requests/{id}/activity", audit);
    }

    [HttpGet("contact-requests/{id:guid}/confirmation-pdf")]
    public async Task<IResult> GetConfirmationPdf(Guid id, CancellationToken ct)
    {
        var item = await FindVisibleAsync(id);
        if (item is null) return Results.NotFound();
        var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
        var latestTransfer = await db.ContactRequestTransfers.AsNoTracking()
            .Where(transfer => transfer.ContactRequestId == id && transfer.ApprovalStatus == "Approved")
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

        if (!db.IsGlobalScope)
        {
            var assignees = new[] { request.AgentId, request.HelpDeskAdvisorId, request.ExpertId }
                .Where(x => x is not null).Select(x => x!.Value).Distinct().ToArray();
            if (assignees.Length > 0)
            {
                var invalidScope = await db.Users
                    .Where(x => assignees.Contains(x.Id))
                    .AnyAsync(x => x.AssignedBrand != db.CurrentTenantId);
                if (invalidScope)
                    return Results.Forbid();
            }
        }

        item.AssignedTo = request.AgentId;
        item.AssignedHelpDeskAdvisorId = request.HelpDeskAdvisorId;
        item.AssignedExpertId = request.ExpertId;
        item.Status = "Assigned";
        item.UserId ??= await db.Users.Where(user => user.Email != null && user.Email.ToLower() == item.Email.ToLower()).Select(user => (Guid?)user.Id).FirstOrDefaultAsync();
        db.Notifications.Add(StatusEmail(item, "Assigned", tenantContext.Current.Name));
        db.AuditLogs.Add(Audit(
            User,
            "ContactRequestAssigned",
            nameof(ContactRequest),
            item.Id,
            null,
            JsonSerializer.Serialize(new
            {
                request.AgentId,
                request.HelpDeskAdvisorId,
                request.ExpertId,
            }, JsonOptions)));
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
        db.Notifications.Add(StatusEmail(item, "Handled", tenantContext.Current.Name));
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
            return Results.NotFound(new { message = "Only the currently responsible centre can request a handover." });

        var destination = tenantDirectory.Find(request.DestinationTenantId);
        if (destination is null)
            return Results.BadRequest(new { message = "Unknown destination centre." });
        if (destination.Id.Equals(item.OwnerTenantId, StringComparison.OrdinalIgnoreCase))
            return Results.Conflict(new { message = "This centre is already responsible for the request." });

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            return Results.BadRequest(new { message = "A handover reason is required." });

        var pending = await db.ContactRequestTransfers.AnyAsync(x =>
            x.ContactRequestId == id && x.ApprovalStatus == "Pending", ct);
        if (pending)
            return Results.Conflict(new { message = "There is already a pending handover approval for this request." });

        var fromId = item.OwnerTenantId;
        var transfer = new ContactRequestTransfer
        {
            ContactRequestId = item.Id,
            FromTenantId = fromId,
            ToTenantId = destination.Id,
            Reason = reason,
            ServiceSnapshotJson = item.ServiceItemsJson,
            TransferredBy = User.UserId(),
            ApprovalStatus = "Pending",
        };

        db.ContactRequestTransfers.Add(transfer);
        db.AuditLogs.Add(Audit(User, $"ContactRequestHandoverRequested:{fromId}->{destination.Id}", nameof(ContactRequest), item.Id));
        await db.SaveChangesAsync(ct);
        return Results.Accepted($"/api/admin/contact-requests/{id}/transfers", transfer);
    }

    [HttpPost("contact-requests/{id:guid}/transfer/{transferId:guid}/approve")]
    public async Task<IResult> ApproveTransfer(Guid id, Guid transferId, ContactRequestTransferApprovalRequest request, CancellationToken ct)
    {
        var transfer = await db.ContactRequestTransfers.FirstOrDefaultAsync(x =>
            x.Id == transferId && x.ContactRequestId == id, ct);
        if (transfer is null)
            return Results.NotFound();
        if (!string.Equals(transfer.ApprovalStatus, "Pending", StringComparison.OrdinalIgnoreCase))
            return Results.Conflict(new { message = "This handover is no longer pending." });

        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision is not ("approve" or "reject"))
            return Results.BadRequest(new { message = "Decision must be approve or reject." });

        var canApproveSource = CanApproveTenant(transfer.FromTenantId);
        var canApproveDestination = CanApproveTenant(transfer.ToTenantId);
        if (!canApproveSource && !canApproveDestination)
            return Results.Forbid();

        var userId = User.UserId();
        if (decision == "reject")
        {
            transfer.ApprovalStatus = "Rejected";
            db.AuditLogs.Add(Audit(User, "ContactRequestHandoverRejected", nameof(ContactRequest), id,
                $"{transfer.FromTenantId}->{transfer.ToTenantId}", transfer.Reason));
            await db.SaveChangesAsync(ct);
            return Results.Ok(transfer);
        }

        // A global/platform administrator may act on either side, but the same account
        // must not be allowed to satisfy both approvals. The two-party rule must remain
        // meaningful even when the approving user has global scope.
        if ((canApproveSource && transfer.DestinationApprovedBy == userId)
            || (canApproveDestination && transfer.SourceApprovedBy == userId))
            return Results.Conflict(new { message = "The two approvals must be made by different administrator accounts." });

        if (canApproveSource && transfer.SourceApprovedBy is null)
        {
            transfer.SourceApprovedBy = userId;
            transfer.SourceApprovedAt = DateTimeOffset.UtcNow;
        }
        else if (canApproveDestination && transfer.DestinationApprovedBy is null)
        {
            transfer.DestinationApprovedBy = userId;
            transfer.DestinationApprovedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            return Results.Conflict(new { message = "Your side of this handover has already been approved." });
        }

        if (transfer.SourceApprovedBy is not null && transfer.DestinationApprovedBy is not null)
        {
            var item = await db.ContactRequests.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (item is null)
                return Results.Conflict(new { message = "The request no longer exists." });
            if (!db.IsGlobalScope
                && !string.Equals(item.OwnerTenantId, db.CurrentTenantId, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(transfer.ToTenantId, db.CurrentTenantId, StringComparison.OrdinalIgnoreCase))
                return Results.Forbid();

            var destination = tenantDirectory.Find(transfer.ToTenantId);
            if (destination is null)
                return Results.BadRequest(new { message = "Unknown destination centre." });

            var from = tenantDirectory.Find(transfer.FromTenantId);
            item.OwnerTenantId = transfer.ToTenantId;
            item.OwnershipTransferredAt = DateTimeOffset.UtcNow;
            item.AssignedTo = null;
            item.AssignedHelpDeskAdvisorId = null;
            item.AssignedExpertId = null;
            transfer.ApprovalStatus = "Approved";
            transfer.CompletedAt = DateTimeOffset.UtcNow;

            var services = JsonSerializer.Deserialize<List<CrmServiceItem>>(item.ServiceItemsJson, JsonOptions) ?? [];
            db.Notifications.Add(new Notification
            {
                TenantId = transfer.ToTenantId,
                RecipientUserId = item.UserId,
                RecipientEmail = item.Email,
                Language = item.PreferredLanguage,
                Type = "ContactRequestTransferred",
                Subject = ContactRequestService.HandoverSubject(item.PreferredLanguage, destination.Name, Reference(item)),
                Body = ContactRequestService.BuildHandoverBody(
                    item,
                    services.Select(service => service.Name),
                    from?.Name ?? transfer.FromTenantId,
                    destination.Name,
                    transfer.Reason),
                ActionUrl = "/portal?tab=crm",
            });
            db.AuditLogs.Add(Audit(User, $"ContactRequestHandoverApproved:{transfer.FromTenantId}->{transfer.ToTenantId}", nameof(ContactRequest), id));
            // The contact request's own ownership moved to the new centre, but the
            // client's OWN account membership decides which brand's Users list even
            // shows them — without updating this too, the new centre's admins could
            // manage the request yet never see the client themselves as a user.
            if (item.UserId is { } clientUserId)
            {
                var clientMembership = await db.UserTenantMemberships
                    .IgnoreQueryFilters()
                    .FirstOrDefaultAsync(x => x.UserId == clientUserId);
                if (clientMembership is not null)
                    clientMembership.TenantId = transfer.ToTenantId;
            }
        }
        else
        {
            db.AuditLogs.Add(Audit(User, "ContactRequestHandoverApprovalRecorded", nameof(ContactRequest), id));
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(transfer);
    }

    private bool CanApproveTenant(string tenantId)
    {
        if (User.IsInRole(PortalRoles.PlatformAdmin))
            return true;
        if (!User.IsInRole(PortalRoles.Admin))
            return false;
        var assignedBrand = User.FindFirst("crm:assigned-brand")?.Value?.Trim();
        var assignedPartner = User.FindFirst("crm:assigned-partner")?.Value?.Trim();
        return string.IsNullOrWhiteSpace(assignedPartner)
            && string.Equals(assignedBrand, tenantId, StringComparison.OrdinalIgnoreCase)
            || User.FindFirst("crm:global-scope")?.Value == "true";
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
                Subject = ResponseSubject(item.PreferredLanguage, tenantContext.Current.Name),
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
        var registerUrl = $"{root}/register?contactRequestId={item.Id}&email={Uri.EscapeDataString(item.Email)}";
        var brandName = System.Net.WebUtility.HtmlEncode(tenantContext.Current.Name);
        var language = item.PreferredLanguage?.ToLowerInvariant() is "en" or "sq" ? item.PreferredLanguage!.ToLowerInvariant() : "mk";
        var (subject, greeting, intro, cta, closing) = language switch
        {
            "en" => (
                $"Create your {tenantContext.Current.Name} account",
                $"Hi {System.Net.WebUtility.HtmlEncode(item.ContactName)},",
                $"Thanks for speaking with our team. You can now create your own {brandName} account to track your request, message us, and see your organization's services in one place.",
                "Create my account",
                "This link is personal — please don't forward it."
            ),
            "sq" => (
                $"Krijoni llogarinë tuaj në {tenantContext.Current.Name}",
                $"Përshëndetje {System.Net.WebUtility.HtmlEncode(item.ContactName)},",
                $"Faleminderit që biseduat me ekipin tonë. Tani mund të krijoni llogarinë tuaj në {brandName} për ta ndjekur kërkesën, të na kontaktoni dhe të shihni shërbimet e organizatës suaj në një vend.",
                "Krijo llogarinë time",
                "Ky lidhje është personal — ju lutemi mos e përcillni."
            ),
            _ => (
                $"Креирajте ja вашата {tenantContext.Current.Name} сметка",
                $"Здраво {System.Net.WebUtility.HtmlEncode(item.ContactName)},",
                $"Ви благодариме што разговаравте со нашиот тим. Сега можете да ja креирате вашата сопствена {brandName} сметка за да го следите вашето барање, да не контактирате и да ги гледате услугите на вашата организација на едно место.",
                "Креирaj ja мojaта сметка",
                "Овoj линк е наменет исклучиво само за вашата регистрациja и после ве молиме не го споделувajте со други лица."
            ),
        };
        db.Notifications.Add(
            new Notification
            {
                RecipientEmail = item.Email,
                Language = item.PreferredLanguage,
                Type = "RegistrationInvitation",
                Subject = subject,
                Body = $"<p>{greeting}</p><p>{intro}</p>"
                    + $"<p><a href=\"{registerUrl}\" style=\"display:inline-block;padding:10px 20px;background:#174f67;color:#fff;text-decoration:none;border-radius:6px;\">{cta}</a></p>"
                    + $"<p style=\"font-size:13px;opacity:.7;\">{closing}</p>",
            }
        );
        // Registration invitation is an activity; it must not replace the CRM status.
        db.AuditLogs.Add(
            Audit(principal, "ContactRegistrationInvited", nameof(ContactRequest), item.Id)
        );
        await db.SaveChangesAsync();
        return Results.Accepted();
    }
    private static Notification StatusEmail(ContactRequest item, string status, string brandName)
    {
        var language = item.PreferredLanguage?.ToLowerInvariant() ?? "mk";
        var isHandled = status == "Handled";
        var subject = language switch
        {
            "en" => isHandled
                ? $"Your {brandName} contact request has been processed"
                : $"Your {brandName} contact request is being processed",
            "sq" => isHandled
                ? $"Kërkesa juaj e kontaktit në {brandName} është përpunuar"
                : $"Kërkesa juaj e kontaktit në {brandName} është në përpunim",
            _ => isHandled
                ? $"Вашето контакт барање до {brandName} е обработено"
                : $"Вашето контакт барање до {brandName} е во обработка",
        };
        var body = language switch
        {
            "en" => isHandled
                ? "<p>Status: <strong>Processed</strong>.</p><p>Your contact request has been completed. If an additional answer or next step is needed, our team will send it to this email address.</p>"
                : $"<p>Status: <strong>In processing</strong>.</p><p>A member of the {brandName} team has started reviewing your contact request.</p>",
            "sq" => isHandled
                ? "<p>Statusi: <strong>E përpunuar</strong>.</p><p>Kërkesa juaj e kontaktit është përfunduar. Nëse nevojitet përgjigje ose hap tjetër, ekipi ynë do ta dërgojë në këtë adresë emaili.</p>"
                : $"<p>Statusi: <strong>Në përpunim</strong>.</p><p>Një anëtar i ekipit {brandName} ka filluar shqyrtimin e kërkesës suaj.</p>",
            _ => isHandled
                ? "<p>Статус: <strong>Обработено</strong>.</p><p>Вашето контакт барање е завршено. Доколку има дополнителен одговор или следен чекор, нашиот тим ќе го испрати на оваа е-пошта.</p>"
                : $"<p>Статус: <strong>Во обработка</strong>.</p><p>Член од тимот на {brandName} започна со разгледување на вашето контакт барање.</p>",
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

    private static string ResponseSubject(string? language, string brandName) =>
        language?.ToLowerInvariant() switch
        {
            "en" => $"{brandName} response to your contact request",
            "sq" => $"Përgjigje nga {brandName} për kërkesën tuaj",
            _ => $"Одговор од {brandName} за вашето контакт барање",
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

    private Task<ContactRequest?> FindVisibleAsync(Guid id) =>
        db.ContactRequests.FirstOrDefaultAsync(item => item.Id == id);

    private Task<ContactRequest?> FindOwnedAsync(Guid id) =>
        db.ContactRequests.FirstOrDefaultAsync(item =>
            item.Id == id && (db.IsGlobalScope || item.OwnerTenantId == db.CurrentTenantId));

    private static string Reference(ContactRequest item) =>
        $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}";

    private async Task<IReadOnlyList<ContactActivityRow>> ContactActivityRows(
        Guid requestId,
        bool includeInternalComments,
        CancellationToken ct)
    {
        var requestEntityId = requestId.ToString();
        var serviceEntityPrefix = $"{requestId}:";
        var actions = await db.AuditLogs.AsNoTracking()
            .Where(log =>
                (log.EntityType == nameof(ContactRequest) && log.EntityId == requestEntityId)
                || (log.EntityType == "CrmServiceItem" && log.EntityId.StartsWith(serviceEntityPrefix))
                || (log.EntityType == "CrmServiceItem" && log.NewValuesJson != null && log.NewValuesJson.Contains(requestEntityId)))
            .Where(log => includeInternalComments || log.Action != "ContactRequestInternalComment")
            .OrderByDescending(log => log.CreatedAt)
            .Take(80)
            .ToListAsync(ct);
        var actorIds = actions
            .Select(action => action.ActorUserId)
            .OfType<Guid>()
            .Distinct()
            .ToArray();
        var actors = await db.Users
            .Where(user => actorIds.Contains(user.Id))
            .Select(user => new { user.Id, user.Email, user.FirstName, user.LastName })
            .ToDictionaryAsync(
                user => user.Id,
                user => string.IsNullOrWhiteSpace($"{user.FirstName} {user.LastName}".Trim())
                    ? user.Email ?? user.Id.ToString()
                    : $"{user.FirstName} {user.LastName}".Trim(),
                ct);

        return actions.Select(action => new ContactActivityRow(
            action.Id,
            action.Action,
            action.EntityType,
            action.EntityId,
            action.ActorUserId,
            action.ActorUserId is { } actorId && actors.TryGetValue(actorId, out var actor)
                ? actor
                : null,
            action.OldValuesJson,
            action.NewValuesJson,
            action.MetadataJson,
            action.CreatedAt)).ToList();
    }

}

public sealed record ContactActivityRow(
    long Id,
    string Action,
    string EntityType,
    string EntityId,
    Guid? ActorUserId,
    string? ActorName,
    string? OldValuesJson,
    string? NewValuesJson,
    string? MetadataJson,
    DateTimeOffset CreatedAt);
