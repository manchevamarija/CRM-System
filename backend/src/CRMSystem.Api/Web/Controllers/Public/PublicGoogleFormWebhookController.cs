using CRMSystem.Application;
using CRMSystem.Application.Tenancy;
using CRMSystem.Domain.Entities;
using CRMSystem.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CRMSystem.Api.Web.Controllers.Public;

/// <summary>
/// Receives new-response notifications from the Google Apps Script bound to the external
/// Google Form (see docs/affiliate-marketing.md). Each brand's plain affiliate link
/// (/digitmak, /vezilka, /hpc, /bau — with or without a partner segment) embeds this same
/// Google Form; this endpoint is how the resulting lead comes back into the CRM so it
/// shows up in the admin panel like any other contact request.
/// </summary>
[ApiController]
[Route("api/public/google-form-webhook")]
public sealed class PublicGoogleFormWebhookController(
    IContactRequestService contactRequests,
    ITenantDirectory tenantDirectory,
    IConfiguration configuration,
    PortalDbContext db) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IResult> Receive(
        GoogleFormSubmissionRequest request,
        CancellationToken ct)
    {
        var expectedToken = configuration["GOOGLE_FORM_WEBHOOK_SECRET"];
        // Accepted via header (X-CRM-Webhook-Token) or, for backwards compatibility with an
        // older Apps Script version, a ?token= query parameter. The header is preferred —
        // it doesn't end up in server access logs the way a query string can.
        var providedToken = Request.Headers["X-CRM-Webhook-Token"].FirstOrDefault()
            ?? Request.Query["token"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(expectedToken) || providedToken != expectedToken)
            return Results.Unauthorized();

        var brand = tenantDirectory.Find(request.Brand?.Trim() ?? "");
        if (brand is null)
            return Results.BadRequest(new { message = "Unknown brand in form submission." });

        if (!request.Consent)
            return Results.BadRequest(new { message = "Consent was not given on the form." });

        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
            return Results.BadRequest(new { message = "Full name and email are required." });

        // Idempotency: the same Google Forms response can trigger the Apps Script webhook
        // more than once (retries, double network sends). Return the existing lead rather
        // than creating a duplicate.
        if (!string.IsNullOrWhiteSpace(request.FormResponseId))
        {
            var existing = await contactRequests.FindByGoogleFormResponseIdAsync(request.FormResponseId.Trim(), ct);
            if (existing is not null)
                return Results.Ok(new { existing.Id, duplicate = true });
        }

        // The Google Form itself intentionally has no Partner question. We therefore
        // correlate the authoritative form-submit webhook with the CRM click record,
        // using only first-party data we actually have server-side: brand, submission
        // timestamp, and clicks that have not already been attributed. We NEVER infer
        // a partner when multiple equally plausible clicks exist.
        //
        // This deliberately does NOT use iframe onLoad/onLoad-count signals. Google Forms
        // is cross-origin and can navigate/reload the iframe for reasons unrelated to a
        // successful submit, so an iframe load must never be treated as a conversion.
        var submittedAt = request.SubmittedAt ?? DateTimeOffset.UtcNow;
        var candidateClicks = await db.AffiliateClicks
            .IgnoreQueryFilters()
            .Where(x => x.AffiliateCode == brand.Id)
            .Where(x => x.CreatedAt <= submittedAt
                && x.CreatedAt >= submittedAt.AddMinutes(-30)
                && !db.ContactRequests.Any(r => r.AffiliateClickId == x.ClickId))
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        // A single recent click is deterministic enough for the normal one-visitor
        // flow. If multiple recent clicks exist, require a clear separation; otherwise
        // leave PartnerCode/AffiliateClickId empty rather than crediting the wrong partner.
        var rankedClicks = candidateClicks
            .OrderBy(x => Math.Abs((x.CreatedAt - submittedAt).TotalSeconds))
            .ThenByDescending(x => x.CreatedAt)
            .ToList();

        AffiliateClick? matchedClick = rankedClicks.Count switch
        {
            1 => rankedClicks[0],
            > 1 when Math.Abs((rankedClicks[0].CreatedAt - submittedAt).TotalSeconds) + 120
                     < Math.Abs((rankedClicks[1].CreatedAt - submittedAt).TotalSeconds) => rankedClicks[0],
            _ => null,
        };

        var matchedPartnerCode = matchedClick?.PartnerCode;
        var matchedClickId = matchedClick?.ClickId;
        var attributionStatus = matchedClick is not null && !string.IsNullOrWhiteSpace(matchedPartnerCode)
            ? "Attributed"
            : matchedClick is not null
                ? "BrandAttributed"
                : candidateClicks.Count > 1
                    ? "Ambiguous"
                    : "Unattributed";
        var attributionReason = matchedClick is not null
            ? "Exactly one sufficiently clear affiliate click candidate matched the form submission."
            : candidateClicks.Count > 1
                ? "Multiple equally plausible affiliate clicks were found; no partner credit was assigned."
                : "No safe affiliate click candidate was found for the form submission.";

        var dto = new ContactRequestDto(
            OrganizationName: string.IsNullOrWhiteSpace(request.OrganizationName) ? "—" : request.OrganizationName,
            OrganizationType: string.IsNullOrWhiteSpace(request.OrganizationType) ? "Друго" : request.OrganizationType,
            Sector: null,
            Municipality: null,
            Region: null,
            Website: null,
            ContactName: request.FullName,
            Email: request.Email,
            Phone: request.Phone,
            PreferredLanguage: "mk",
            EmployeeCount: null,
            DigitalMaturityRating: 3,
            MainNeed: request.Need,
            ChallengeDescription: request.Need,
            CurrentTools: null,
            CurrentDataSources: null,
            UsesAi: null,
            AiUseCase: null,
            PrivacyConcerns: null,
            InterestedInAiActGuidance: false,
            TrainingNeeds: null,
            DesiredTimeline: null,
            PreferredConsultationFormat: null,
            ConsentToContact: true,
            PrivacyPolicyAccepted: true,
            DmaCategory: null,
            RequestType: "Consultation",
            TaxNumber: null,
            RegistrationNumber: null,
            Address: null,
            SelectedServices: null,
            BudgetRange: null,
            AffiliateCode: brand.Id,
            PartnerCode: matchedPartnerCode,
            AffiliateClickId: matchedClickId,
            SourceTenantId: brand.Id,
            AttributionStatus: attributionStatus,
            AttributionReason: attributionReason
        );

        try
        {
            var item = await contactRequests.CreateAsync(dto, ct);
            if (!string.IsNullOrWhiteSpace(request.FormResponseId))
                await contactRequests.SetGoogleFormResponseIdAsync(item.Id, request.FormResponseId.Trim(), ct);

            // Mark the exact click as converted only after the CRM lead is successfully
            // created. This makes conversion reporting authoritative and idempotent.
            if (matchedClick is not null && matchedClick.ConvertedAt is null)
            {
                matchedClick.ConvertedAt = submittedAt;
                await db.SaveChangesAsync(ct);
            }

            return Results.Created($"/api/admin/contact-requests/{item.Id}", new
            {
                item.Id,
                attributionStatus,
                attributionReason,
                attributedPartner = matchedPartnerCode
            });
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new { message = ex.Message });
        }
    }
}
