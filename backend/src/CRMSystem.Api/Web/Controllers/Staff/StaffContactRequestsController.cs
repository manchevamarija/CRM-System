using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;

namespace CRMSystem.Api.Web.Controllers.Staff;

[ApiController]
[Route("api/staff/contact-requests")]
[Authorize(Policy = "Staff")]
public sealed class StaffContactRequestsController(PortalDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IResult> Get(int? page, int? pageSize, CancellationToken ct)
    {
        var principal = User;
        var items = await db
            .ContactRequests.OrderByDescending(x => x.CreatedAt)
            .Skip((Math.Max(page ?? 1, 1) - 1) * Math.Clamp(pageSize ?? 50, 1, 100))
            .Take(Math.Clamp(pageSize ?? 50, 1, 100))
            .ToListAsync(ct);
        return Results.Ok(items);
    }

    [HttpPatch("{id:guid}/workflow")]
    public async Task<IResult> UpdateWorkflow(Guid id, WorkflowRequest request, CancellationToken ct)
    {
        string[] allowed = ["Contacting", "Assigned", "ServicesConfirmed", "InService", "FollowUp", "Served"];
        if (!allowed.Contains(request.Status)) return Results.BadRequest(new { message = "Unsupported CRM status." });
        var item = await db.ContactRequests.FindAsync([id], ct);
        if (item is null) return Results.NotFound();
        var userId = User.UserId();
        item.AssignedTo ??= userId;
        item.Status = request.Status == "Contacting" ? "Assigned" : request.Status;
        db.AuditLogs.Add(new AuditLog { ActorUserId = userId, Action = "StaffContactWorkflowUpdated", EntityType = nameof(ContactRequest), EntityId = id.ToString(), NewValuesJson = item.Status });
        db.Notifications.Add(new Notification { RecipientUserId = item.UserId, RecipientEmail = item.Email, Language = item.PreferredLanguage, Type = "CrmStatusChanged", Subject = $"CRM статус: {item.Status}", Body = $"<p>Вашето барање е ажурирано. Нов статус: <strong>{item.Status}</strong>.</p>", ActionUrl = "/portal?tab=crm" });
        await db.SaveChangesAsync(ct);
        return Results.Ok(item);
    }

    public sealed record WorkflowRequest(string Status);
}
