using CRMSystem.Application.Tenancy;
using CRMSystem.Domain.Entities;
using CRMSystem.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Api.Web.Controllers.Public;

[ApiController]
[Route("api/public/affiliate")]
public sealed class PublicAffiliateController(PortalDbContext db, ITenantDirectory tenantDirectory) : ControllerBase
{
    [HttpPost("click")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> TrackClick(AffiliateClickRequest request, CancellationToken ct)
    {
        var brand = tenantDirectory.Find(request.Code?.Trim() ?? "");
        if (brand is null)
            return Results.BadRequest(new { message = "Unknown affiliate source." });

        if (!AffiliateMarketing.TryNormalizePartnerCode(request.PartnerCode, out var partnerCode))
            return Results.BadRequest(new { message = "Invalid affiliate partner code." });

        var expectedPath = partnerCode.Length == 0 ? $"/{brand.Id}" : $"/{brand.Id}/{partnerCode}";
        var clickId = Guid.NewGuid().ToString("N");
        db.AffiliateClicks.Add(new AffiliateClick
        {
            AffiliateCode = brand.Id,
            PartnerCode = partnerCode.Length == 0 ? null : partnerCode,
            ClickId = clickId,
            LandingPath = string.IsNullOrWhiteSpace(request.LandingPath) ? expectedPath : request.LandingPath.Trim(),
            Referrer = request.Referrer?.Trim(),
            UserAgent = Request.Headers.UserAgent.ToString(),
        });
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { clickId, code = brand.Id, partnerCode = partnerCode.Length == 0 ? null : partnerCode });
    }

    [HttpPost("convert")]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> TrackConversion(AffiliateConvertRequest request, CancellationToken ct)
    {
        var brand = tenantDirectory.Find(request.AffiliateCode?.Trim() ?? "");
        if (brand is null || string.IsNullOrWhiteSpace(request.ClickId))
            return Results.BadRequest(new { message = "Invalid conversion signal." });

        var click = await db.AffiliateClicks
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.ClickId == request.ClickId
                && x.AffiliateCode == brand.Id
                && x.PartnerCode == (string.IsNullOrWhiteSpace(request.PartnerCode) ? null : request.PartnerCode.Trim().ToLowerInvariant()), ct);

        // Browser-side conversion signals are intentionally non-authoritative. A click is
        // only marked converted after the Google Form webhook has created a real CRM lead.
        var hasLead = click is not null && await db.ContactRequests
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(x => x.AffiliateClickId == request.ClickId && x.AffiliateCode == brand.Id, ct);

        if (click is not null && hasLead && click.ConvertedAt is null)
        {
            click.ConvertedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return Results.Ok(new { authoritative = hasLead });
    }

}
