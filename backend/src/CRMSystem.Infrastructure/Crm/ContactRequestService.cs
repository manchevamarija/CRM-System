using System.Security.Claims;
using System.Text.Json;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Infrastructure.Persistence.Repositories;
using CRMSystem.Application;
using CRMSystem.Application.Realtime;
using CRMSystem.Application.Tenancy;

namespace CRMSystem.Infrastructure.Services;

public sealed class ContactRequestService(IContactRequestRepository repository, ITenantContext tenantContext) : IContactRequestService
{
    public async Task<ContactRequest> CreateAsync(ContactRequestDto r, CancellationToken ct)
    {
        if (!r.ConsentToContact || !r.PrivacyPolicyAccepted)
            throw new ArgumentException("Consent and privacy acceptance are required.");
        if (r.DigitalMaturityRating is < 1 or > 5)
            throw new ArgumentException("Digital maturity rating must be between 1 and 5.");
        var dmaCategory = DmaCategoryMapping.Resolve(r);
        var association = await repository.ResolveAssociationAsync(r.Email, r.OrganizationName, ct);
        var item = new ContactRequest
        {
            CreatedTenantId = tenantContext.Current.Id,
            OwnerTenantId = tenantContext.Current.Id,
            UserId = association.UserId,
            LinkedOrganizationId = association.OrganizationId,
            RequestType = r.RequestType is "Partnership" ? "Partnership" : "Consultation",
            OrganizationName = r.OrganizationName.Trim(),
            OrganizationType = r.OrganizationType.Trim(),
            Sector = r.Sector,
            Municipality = r.Municipality,
            Region = r.Region,
            Website = r.Website,
            TaxNumber = r.TaxNumber,
            RegistrationNumber = r.RegistrationNumber,
            Address = r.Address,
            ContactName = r.ContactName.Trim(),
            Email = r.Email.Trim(),
            Phone = r.Phone,
            PreferredLanguage = string.IsNullOrWhiteSpace(r.PreferredLanguage)
                ? "mk"
                : r.PreferredLanguage,
            EmployeeCount = r.EmployeeCount,
            DigitalMaturityRating = r.DigitalMaturityRating,
            DmaCategory = dmaCategory,
            MainNeed = r.MainNeed,
            ChallengeDescription = r.ChallengeDescription,
            CurrentTools = r.CurrentTools,
            CurrentDataSources = r.CurrentDataSources,
            UsesAi = r.UsesAi,
            AiUseCase = r.AiUseCase,
            PrivacyConcerns = r.PrivacyConcerns,
            InterestedInAiActGuidance = r.InterestedInAiActGuidance,
            TrainingNeeds = r.TrainingNeeds,
            DesiredTimeline = r.DesiredTimeline,
            PreferredConsultationFormat = r.PreferredConsultationFormat,
            SelectedServices = r.SelectedServices,
            ServiceItemsJson = BuildServiceItems(r.SelectedServices),
            BudgetRange = r.BudgetRange,
            ConsentToContact = true,
            PrivacyPolicyAccepted = true,
        };
        var confirmation = new Notification
        {
            RecipientEmail = item.Email,
            Language = string.IsNullOrWhiteSpace(r.PreferredLanguage) ? "mk" : r.PreferredLanguage,
            Type = "ContactRequestConfirmation",
            Subject = ConfirmationSubject(item.PreferredLanguage, $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}"),
            Body = BuildConfirmationBody(item),
        };
        var adminUserIds = await repository.GetAdminUserIdsAsync(ct);
        var adminNotifications = adminUserIds
            .Select(adminId => new Notification
            {
                RecipientUserId = adminId,
                Type = "ContactRequestReceived",
                Subject = $"Ново барање за контакт: {item.OrganizationName}",
                Body =
                    $"<p>{item.ContactName} ({item.Email}) поднесе барање за контакт во име на „{item.OrganizationName}“.</p>",
                ActionUrl = "/admin?tab=contacts",
            })
            .ToList();
        var notifications = new List<Notification> { confirmation };
        notifications.AddRange(adminNotifications);
        var auditLog = new AuditLog
        {
            Action = "ContactRequestCreated",
            EntityType = nameof(ContactRequest),
            EntityId = item.Id.ToString(),
        };
        await repository.AddAsync(item, notifications, auditLog, ct);
        return item;
    }

    private static string BuildServiceItems(string? selectedServices)
    {
        string[] names;
        try { names = JsonSerializer.Deserialize<string[]>(selectedServices ?? "[]") ?? []; }
        catch { names = []; }
        return JsonSerializer.Serialize(names.Select((name, index) => new
        {
            id = Guid.NewGuid(),
            name,
            status = "Selected",
            price = (decimal?)null,
            deadline = (DateTimeOffset?)null,
            assignedAgentId = (Guid?)null,
            order = index,
        }));
    }

    private string BuildConfirmationBody(ContactRequest item)
    {
        string[] names;
        try { names = JsonSerializer.Deserialize<string[]>(item.SelectedServices ?? "[]") ?? []; }
        catch { names = []; }
        var language = NormalizeLanguage(item.PreferredLanguage);
        var list = names.Length == 0 ? "" : $"<p><strong>{Text(language, "Избрани услуги", "Selected services", "Shërbimet e zgjedhura")}:</strong></p><ul>{string.Join("", names.Select(name => $"<li>{System.Net.WebUtility.HtmlEncode(name)}</li>"))}</ul>";
        var reference = $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}";
        var attachment = BuildPdfAttachment(item, names, "CRM-potvrda", false, tenantContext.Current.Name);
        return $"<p>{Text(language, "Почитувани", "Dear", "I nderuar/a")} {System.Net.WebUtility.HtmlEncode(item.ContactName)},</p><p>{Text(language, "Вашето барање е успешно примено под број", "Your request has been received under reference", "Kërkesa juaj u pranua me numrin")} <strong>{reference}</strong>.</p>{list}<p>{Text(language, "Во прилог е вашата персонализирана PDF потврда. Нашиот тим ќе одговори во рок од два работни дена.", "Your personalised PDF confirmation is attached. Our team will reply within two business days.", "Bashkëngjitur gjeni konfirmimin tuaj PDF. Ekipi ynë do të përgjigjet brenda dy ditëve pune.")}</p>{attachment}";
    }

    public static string BuildPdfAttachment(ContactRequest item, IEnumerable<string> services, string filePrefix, bool isUpdate, string brandName = "CRM System")
        => ContactRequestPdfRenderer.BuildAttachment(item, services, filePrefix, isUpdate, brandName);

    public static string BuildHandoverBody(
        ContactRequest item,
        IEnumerable<string> services,
        string fromTenant,
        string toTenant,
        string reason)
    {
        var language = NormalizeLanguage(item.PreferredLanguage);
        var reference = $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}";
        var encodedDestination = System.Net.WebUtility.HtmlEncode(toTenant);
        var encodedReason = System.Net.WebUtility.HtmlEncode(reason);
        var attachment = BuildHandoverPdfAttachment(item, services, fromTenant, toTenant, reason);
        return $"<p>{Text(language, "Почитувани", "Dear", "I nderuar/a")} {System.Net.WebUtility.HtmlEncode(item.ContactName)},</p>"
            + $"<p>{Text(language, "Вашето постоечко барање", "Your existing request", "Kërkesa juaj ekzistuese")} <strong>{reference}</strong> "
            + $"{Text(language, "е предадено на", "has been handed over to", "i është dorëzuar")} <strong>{encodedDestination}</strong>. "
            + $"{Text(language, "Не е отворено ново барање и сите услуги, документи и историја остануваат зачувани.", "No new request was created; all services, documents and history remain attached to the same request.", "Nuk u krijua kërkesë e re; të gjitha shërbimet, dokumentet dhe historia mbeten në të njëjtën kërkesë.")}</p>"
            + $"<p><strong>{Text(language, "Причина", "Reason", "Arsyeja")}:</strong> {encodedReason}</p>"
            + $"<p>{Text(language, "Во прилог е ажурираната PDF потврда со моменталните услуги и новиот одговорен центар.", "The updated PDF confirmation with the current services and new responsible centre is attached.", "Bashkëngjitur është konfirmimi i përditësuar PDF me shërbimet aktuale dhe qendrën e re përgjegjëse.")}</p>{attachment}";
    }

    public static string HandoverSubject(string language, string destination, string reference) =>
        $"{Text(NormalizeLanguage(language), "Примопредавање на барање", "Request handover", "Dorëzimi i kërkesës")} · {reference} · {destination}";

    public static string BuildHandoverPdfAttachment(
        ContactRequest item,
        IEnumerable<string> services,
        string fromTenant,
        string toTenant,
        string reason)
        => ContactRequestPdfRenderer.BuildHandoverAttachment(item, services, fromTenant, toTenant, reason);

    public static byte[] BuildHandoverPdfBytes(
        ContactRequest item,
        IEnumerable<string> services,
        string fromTenant,
        string toTenant,
        string reason)
        => ContactRequestPdfRenderer.BuildHandover(item, services, fromTenant, toTenant, reason);

    public static byte[] BuildCurrentPdfBytes(ContactRequest item, IEnumerable<string> services, string brandName)
        => ContactRequestPdfRenderer.BuildCurrent(item, services, brandName);

    private static string NormalizeLanguage(string? language) => language is "en" or "sq" ? language : "mk";
    private static string Text(string language, string mk, string en, string sq) => language == "en" ? en : language == "sq" ? sq : mk;
    private static string ConfirmationSubject(string language, string reference) => $"{Text(NormalizeLanguage(language), "Потврда за побарани услуги", "Confirmation of requested services", "Konfirmim për shërbimet e kërkuara")} · {reference}";
}
