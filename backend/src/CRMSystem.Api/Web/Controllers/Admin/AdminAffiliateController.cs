using Microsoft.AspNetCore.Authorization;
using CRMSystem.Application.Tenancy;
using CRMSystem.Domain.Entities;
using CRMSystem.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Api.Web.Controllers.Admin;

public record CreateAffiliatePartnerRequest(string BrandCode, string PartnerCode, string? Name, Guid? LinkedOrganizationId = null);
public record SetPartnerOrganizationRequest(Guid? LinkedOrganizationId);

[ApiController]
[Authorize(Policy = "Admin")]
[Route("api/admin/affiliate")]
public sealed class AdminAffiliateController(PortalDbContext db, ITenantDirectory tenantDirectory) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IResult> Overview(CancellationToken ct)
    {
        var clickGroups = await db.AffiliateClicks.AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(db.AssignedPartnerCode) || x.PartnerCode == db.AssignedPartnerCode)
            .GroupBy(x => x.AffiliateCode)
            .Select(g => new { Code = g.Key, Clicks = g.Count() })
            .ToListAsync(ct);

        // Best-effort "the visitor's browser suggests they submitted the embedded Google
        // Form" signal — faster than the webhook-created lead, but not authoritative on
        // its own (see AffiliateClick.ConvertedAt and AffiliateGoogleFormPage.tsx).
        var conversionGroups = await db.AffiliateClicks.AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(db.AssignedPartnerCode) || x.PartnerCode == db.AssignedPartnerCode)
            .Where(x => x.ConvertedAt != null)
            .GroupBy(x => x.AffiliateCode)
            .Select(g => new { Code = g.Key, Conversions = g.Count() })
            .ToListAsync(ct);

        var leadGroups = await db.ContactRequests.AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(db.AssignedPartnerCode) || x.PartnerCode == db.AssignedPartnerCode)
            .Where(x => x.AffiliateCode != null && x.AffiliateCode != "")
            .GroupBy(x => x.AffiliateCode!)
            .Select(g => new
            {
                Code = g.Key,
                Leads = g.Count(),
                Served = g.Count(x => x.Status == "Served" || x.Status == "Handled"),
            })
            .ToListAsync(ct);

        var attributionGroups = await db.ContactRequests.AsNoTracking()
            .Where(x => string.IsNullOrWhiteSpace(db.AssignedPartnerCode) || x.PartnerCode == db.AssignedPartnerCode)
            .Where(x => x.AffiliateCode != null && x.AffiliateCode != "")
            .GroupBy(x => new { x.AffiliateCode, x.AttributionStatus })
            .Select(g => new { Code = g.Key.AffiliateCode!, Status = g.Key.AttributionStatus, Count = g.Count() })
            .ToListAsync(ct);

        // Every known brand always shows here, even with zero affiliate traffic yet — this
        // is a management view, not just a traffic report.
        var visibleBrands = db.IsGlobalScope
            ? tenantDirectory.All
            : tenantDirectory.All.Where(brand => brand.Id.Equals(db.CurrentTenantId, StringComparison.OrdinalIgnoreCase)).ToArray();
        var rows = visibleBrands
            .Select(brand =>
            {
                var code = brand.Id;
                var clickCount = clickGroups.FirstOrDefault(x => x.Code == code)?.Clicks ?? 0;
                var conversionCount = conversionGroups.FirstOrDefault(x => x.Code == code)?.Conversions ?? 0;
                var lead = leadGroups.FirstOrDefault(x => x.Code == code);
                var leads = lead?.Leads ?? 0;
                return new
                {
                    code,
                    name = brand.Name,
                    path = $"/{code}",
                    clicks = clickCount,
                    formSubmissions = conversionCount,
                    leads,
                    served = lead?.Served ?? 0,
                    attributedLeads = attributionGroups.Where(x => x.Code == code && x.Status == "Attributed").Sum(x => x.Count),
                    ambiguousLeads = attributionGroups.Where(x => x.Code == code && x.Status == "Ambiguous").Sum(x => x.Count),
                    unattributedLeads = attributionGroups.Where(x => x.Code == code && (x.Status == "Unattributed" || x.Status == "BrandAttributed")).Sum(x => x.Count),
                    conversionRate = clickCount == 0 ? 0 : Math.Round(leads * 100d / clickCount, 2),
                };
            })
            .OrderByDescending(x => x.leads)
            .ThenByDescending(x => x.clicks)
            .ToList();

        var partnerClickGroups = await db.AffiliateClicks.AsNoTracking()
            .Where(x => x.PartnerCode != null && x.PartnerCode != "")
            .GroupBy(x => new { x.AffiliateCode, x.PartnerCode })
            .Select(g => new { g.Key.AffiliateCode, PartnerCode = g.Key.PartnerCode!, Clicks = g.Count() })
            .ToListAsync(ct);

        var partnerConversionGroups = await db.AffiliateClicks.AsNoTracking()
            .Where(x => x.PartnerCode != null && x.PartnerCode != "" && x.ConvertedAt != null)
            .GroupBy(x => new { x.AffiliateCode, x.PartnerCode })
            .Select(g => new { g.Key.AffiliateCode, PartnerCode = g.Key.PartnerCode!, Conversions = g.Count() })
            .ToListAsync(ct);

        var partnerLeadGroups = await db.ContactRequests.AsNoTracking()
            .Where(x => x.PartnerCode != null && x.PartnerCode != "")
            .GroupBy(x => new { x.AffiliateCode, x.PartnerCode })
            .Select(g => new
            {
                g.Key.AffiliateCode,
                PartnerCode = g.Key.PartnerCode!,
                Leads = g.Count(),
                Served = g.Count(x => x.Status == "Served" || x.Status == "Handled"),
            })
            .ToListAsync(ct);

        // Registered partners (created by an admin, e.g. "partner-01" under "bau") always
        // show here, even with zero clicks — that is what makes it possible to hand out a
        // full set of links before any of them has been used. Any partner slug that shows
        // up in real traffic but was never registered also shows, so nothing gets lost.
        var registeredPartners = await db.AffiliatePartners.AsNoTracking()
            .Where(x => x.IsActive)
            .Where(x => db.IsGlobalScope || x.BrandCode == db.CurrentTenantId)
            .Where(x => string.IsNullOrWhiteSpace(db.AssignedPartnerCode) || x.PartnerCode == db.AssignedPartnerCode)
            .ToListAsync(ct);

        var linkedOrganizationIds = registeredPartners
            .Where(x => x.LinkedOrganizationId != null)
            .Select(x => x.LinkedOrganizationId!.Value)
            .Distinct()
            .ToList();
        var linkedOrganizationNames = await db.Organizations.AsNoTracking()
            .Where(x => linkedOrganizationIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        var partnerKeys = registeredPartners
            .Select(x => (Brand: x.BrandCode, Partner: x.PartnerCode))
            .Concat(partnerClickGroups.Select(x => (Brand: x.AffiliateCode!, Partner: x.PartnerCode)))
            .Concat(partnerLeadGroups.Select(x => (Brand: x.AffiliateCode!, Partner: x.PartnerCode)))
            .Distinct();

        var partners = partnerKeys
            .Select(key =>
            {
                var registered = registeredPartners.FirstOrDefault(x => x.BrandCode == key.Brand && x.PartnerCode == key.Partner);
                var clickCount = partnerClickGroups
                    .FirstOrDefault(x => x.AffiliateCode == key.Brand && x.PartnerCode == key.Partner)?.Clicks ?? 0;
                var conversionCount = partnerConversionGroups
                    .FirstOrDefault(x => x.AffiliateCode == key.Brand && x.PartnerCode == key.Partner)?.Conversions ?? 0;
                var lead = partnerLeadGroups
                    .FirstOrDefault(x => x.AffiliateCode == key.Brand && x.PartnerCode == key.Partner);
                var leads = lead?.Leads ?? 0;
                return new
                {
                    id = registered?.Id,
                    brandCode = key.Brand,
                    brandName = tenantDirectory.Find(key.Brand ?? "")?.Name ?? AffiliateMarketing.BrandName(key.Brand ?? ""),
                    partnerCode = key.Partner,
                    partnerName = registered?.Name,
                    registered = registered is not null,
                    path = $"/{key.Brand}/{key.Partner}",
                    clicks = clickCount,
                    formSubmissions = conversionCount,
                    leads,
                    attributedLeads = lead?.Leads ?? 0,
                    served = lead?.Served ?? 0,
                    conversionRate = clickCount == 0 ? 0 : Math.Round(leads * 100d / clickCount, 2),
                    linkedOrganizationId = registered?.LinkedOrganizationId,
                    linkedOrganizationName = registered?.LinkedOrganizationId != null && linkedOrganizationNames.TryGetValue(registered.LinkedOrganizationId.Value, out var orgName) ? orgName : null,
                };
            })
            .OrderBy(x => x.brandCode)
            .ThenByDescending(x => x.leads)
            .ThenByDescending(x => x.clicks)
            .ToList();

        return Results.Ok(new
        {
            partners = rows,
            partnerBreakdown = partners,
            totals = new
            {
                clicks = rows.Sum(x => x.clicks),
                formSubmissions = rows.Sum(x => x.formSubmissions),
                leads = rows.Sum(x => x.leads),
                attributedLeads = rows.Sum(x => x.attributedLeads),
                ambiguousLeads = rows.Sum(x => x.ambiguousLeads),
                unattributedLeads = rows.Sum(x => x.unattributedLeads),
                served = rows.Sum(x => x.served),
                conversionRate = rows.Sum(x => x.clicks) == 0 ? 0 : Math.Round(rows.Sum(x => x.leads) * 100d / rows.Sum(x => x.clicks), 2),
            },
        });
    }

    [HttpGet("partners")]
    public async Task<IResult> ListPartners(CancellationToken ct)
    {
        var items = await db.AffiliatePartners.AsNoTracking()
            .Where(x => db.IsGlobalScope || x.BrandCode == db.CurrentTenantId)
            .Where(x => string.IsNullOrWhiteSpace(db.AssignedPartnerCode) || x.PartnerCode == db.AssignedPartnerCode)
            .OrderBy(x => x.BrandCode).ThenBy(x => x.PartnerCode)
            .ToListAsync(ct);
        var linkedOrganizationIds = items.Where(p => p.LinkedOrganizationId != null).Select(p => p.LinkedOrganizationId!.Value).Distinct().ToList();
        var organizationNames = await db.Organizations.AsNoTracking()
            .Where(x => linkedOrganizationIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var result = items.Select(x => new
        {
            x.Id,
            x.BrandCode,
            brandName = tenantDirectory.Find(x.BrandCode)?.Name ?? AffiliateMarketing.BrandName(x.BrandCode),
            x.PartnerCode,
            x.Name,
            x.IsActive,
            path = $"/{x.BrandCode}/{x.PartnerCode}",
            linkedOrganizationId = x.LinkedOrganizationId,
            linkedOrganizationName = x.LinkedOrganizationId != null && organizationNames.TryGetValue(x.LinkedOrganizationId.Value, out var name) ? name : null,
        });
        return Results.Ok(result);
    }

    [HttpPost("partners")]
    public async Task<IResult> CreatePartner(CreateAffiliatePartnerRequest request, CancellationToken ct)
    {
        if (!db.IsGlobalScope) return Results.Forbid();
        var brand = tenantDirectory.Find(request.BrandCode?.Trim() ?? "");
        if (brand is null)
            return Results.BadRequest(new { message = "Unknown brand." });

        if (!AffiliateMarketing.TryNormalizePartnerCode(request.PartnerCode, out var partnerCode) || partnerCode.Length == 0)
            return Results.BadRequest(new { message = "Invalid partner code." });

        var exists = await db.AffiliatePartners
            .AnyAsync(x => x.BrandCode == brand.Id && x.PartnerCode == partnerCode, ct);
        if (exists)
            return Results.Conflict(new { message = "This partner already exists under this brand." });

        var partner = new AffiliatePartner
        {
            BrandCode = brand.Id,
            PartnerCode = partnerCode,
            Name = string.IsNullOrWhiteSpace(request.Name) ? partnerCode : request.Name.Trim(),
            IsActive = true,
            LinkedOrganizationId = request.LinkedOrganizationId,
        };
        db.AffiliatePartners.Add(partner);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/admin/affiliate/partners/{partner.Id}", new
        {
            partner.Id,
            partner.BrandCode,
            brandName = brand.Name,
            partner.PartnerCode,
            partner.Name,
            partner.IsActive,
            path = $"/{partner.BrandCode}/{partner.PartnerCode}",
        });
    }

    [HttpDelete("partners/{id:guid}")]
    public async Task<IResult> DeletePartner(Guid id, CancellationToken ct)
    {
        if (!db.IsGlobalScope) return Results.Forbid();
        var partner = await db.AffiliatePartners.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (partner is null)
            return Results.NotFound();
        db.AffiliatePartners.Remove(partner);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    /// <summary>Connects (or disconnects) a registered partner to a CRM organization —
    /// leads arriving through that partner's link then auto-link to this organization
    /// instead of needing a manual "Поврзи со организација" step. See
    /// ContactRequestService.CreateAsync.</summary>
    [HttpPut("partners/{id:guid}/organization")]
    public async Task<IResult> SetPartnerOrganization(Guid id, SetPartnerOrganizationRequest request, CancellationToken ct)
    {
        if (!db.IsGlobalScope) return Results.Forbid();
        var partner = await db.AffiliatePartners.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (partner is null)
            return Results.NotFound();
        if (request.LinkedOrganizationId is not null)
        {
            var organizationExists = await db.Organizations.AnyAsync(x => x.Id == request.LinkedOrganizationId, ct);
            if (!organizationExists)
                return Results.BadRequest(new { message = "Organization not found." });
        }
        partner.LinkedOrganizationId = request.LinkedOrganizationId;
        await db.SaveChangesAsync(ct);
        return Results.Ok();
    }
}
