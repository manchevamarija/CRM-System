using System.Text.RegularExpressions;

namespace CRMSystem.Application;

public static partial class EmailTemplates
{
    private static readonly Dictionary<string, (string Subject, string Body)> Macedonian = new()
    {
        ["EmailVerification"] = (
            "Потврда на е-пошта",
            "<p>Потврдете ја вашата CRM System — One Stop Shop Portal сметка за да продолжите.</p>"
        ),
        ["PasswordReset"] = (
            "Промена на лозинка",
            "<p>Добивме барање за промена на лозинката на вашата CRM System — One Stop Shop Portal сметка.</p>"
        ),
        ["OrganizationSubmitted"] = (
            "Организацијата е испратена",
            "<p>Вашата организација е испратена на администраторска проверка.</p>"
        ),
        ["OrganizationApproved"] = (
            "Организацијата е одобрена",
            "<p>Вашата организација е одобрена во CRM System — One Stop Shop Portal порталот.</p>"
        ),
        ["OrganizationRejected"] = (
            "Организацијата е одбиена",
            "<p>Вашата организација не беше одобрена. Контактирајте го CRM System — One Stop Shop Portal тимот за дополнителни информации.</p>"
        ),
        ["OrganizationSuspended"] = (
            "Организацијата е суспендирана",
            "<p>Пристапот на организацијата е привремено суспендиран.</p>"
        ),
        ["OrganizationMembershipChanged"] = (
            "Промена на членството",
            "<p>Статусот на вашето членство во организацијата е променет.</p>"
        ),
        ["SubscriptionInvitation"] = (
            "Покана за претплата",
            "<p>Имате покана за лична годишна CRM System — One Stop Shop Portal претплата.</p>"
        ),
        ["SubscriptionActivated"] = (
            "Претплатата е активна",
            "<p>Вашата CRM System — One Stop Shop Portal претплата е активирана.</p>"
        ),
        ["SubscriptionExpiringSoon"] = (
            "Претплатата истекува наскоро",
            "<p>Вашата претплата истекува наскоро. Контактирајте го CRM System — One Stop Shop Portal тимот за продолжување.</p>"
        ),
        ["SubscriptionExpired"] = (
            "Претплатата е истечена",
            "<p>Вашата CRM System — One Stop Shop Portal претплата е истечена.</p>"
        ),
        ["SubscriptionCancelled"] = (
            "Претплатата е откажана",
            "<p>Вашата CRM System — One Stop Shop Portal претплата е откажана.</p>"
        ),
        ["ContactRequestConfirmation"] = (
            "Контакт барањето е примено",
            "<p>Го примивме вашето контакт барање. Тимот ќе одговори во рок од два работни дена.</p>"
        ),
        ["ContactRequestResponse"] = (
            "Одговор од CRM System — One Stop Shop Portal",
            "<p>Тимот на CRM System — One Stop Shop Portal испрати одговор на вашето барање:</p>"
        ),
        ["RegistrationInvitation"] = (
            "Покана за регистрација",
            "<p>Креирајте CRM System — One Stop Shop Portal сметка за да продолжите со услугата.</p>"
        ),
        ["TicketCreated"] = (
            "Тикетот е креиран",
            "<p>Вашиот тикет е успешно креиран во CRM System — One Stop Shop Portal порталот.</p>"
        ),
        ["TicketAssigned"] = (
            "Тикетот е доделен",
            "<p>Вашиот тикет е доделен на член од CRM System — One Stop Shop Portal тимот.</p>"
        ),
        ["TicketStatusChanged"] = (
            "Променет статус на тикет",
            "<p>Статусот на вашиот тикет е променет. Отворете го порталот за детали.</p>"
        ),
        ["TicketMessageCreated"] = (
            "Нова порака во тикет",
            "<p>Имате нова порака во вашиот CRM System — One Stop Shop Portal тикет.</p>"
        ),
        ["TicketResolved"] = (
            "Тикетот е решен",
            "<p>Тикетот е означен како решен. Прегледајте ја финалната препорака во порталот.</p>"
        ),
        ["MeetingRequested"] = (
            "Побаран е состанок",
            "<p>Вашето барање за состанок е примено.</p>"
        ),
        ["MeetingConfirmed"] = (
            "Состанокот е потврден",
            "<p>Вашиот CRM System — One Stop Shop Portal состанок е потврден. Деталите се достапни во порталот.</p>"
        ),
        ["MeetingRejected"] = (
            "Состанокот е одбиен",
            "<p>Барањето за состанок не е потврдено. Отворете го порталот за детали.</p>"
        ),
        ["MeetingCancelled"] = ("Состанокот е откажан", "<p>Состанокот е откажан.</p>"),
        ["MeetingCompleted"] = (
            "Состанокот е завршен",
            "<p>Состанокот е означен како завршен.</p>"
        ),
    };

    private static readonly Dictionary<string, (string Subject, string Body)> Albanian = new()
    {
        ["EmailVerification"] = (
            "Konfirmimi i email-it",
            "<p>Konfirmoni llogarinë tuaj CRM System — One Stop Shop Portal për të vazhduar.</p>"
        ),
        ["PasswordReset"] = (
            "Ndryshimi i fjalëkalimit",
            "<p>Pranuam një kërkesë për ndryshimin e fjalëkalimit të llogarisë suaj.</p>"
        ),
        ["OrganizationSubmitted"] = (
            "Organizata u dorëzua",
            "<p>Organizata juaj u dërgua për verifikim administrativ.</p>"
        ),
        ["OrganizationApproved"] = (
            "Organizata u miratua",
            "<p>Organizata juaj u miratua në portalin CRM System — One Stop Shop Portal.</p>"
        ),
        ["OrganizationRejected"] = (
            "Organizata u refuzua",
            "<p>Organizata nuk u miratua. Kontaktoni ekipin CRM System — One Stop Shop Portal për më shumë informacion.</p>"
        ),
        ["OrganizationSuspended"] = (
            "Organizata u pezullua",
            "<p>Qasja e organizatës është pezulluar përkohësisht.</p>"
        ),
        ["OrganizationMembershipChanged"] = (
            "Ndryshim i anëtarësimit",
            "<p>Statusi i anëtarësimit tuaj në organizatë ka ndryshuar.</p>"
        ),
        ["SubscriptionInvitation"] = (
            "Ftesë për abonim",
            "<p>Keni një ftesë për abonim personal vjetor në CRM System — One Stop Shop Portal.</p>"
        ),
        ["SubscriptionActivated"] = (
            "Abonimi është aktiv",
            "<p>Abonimi juaj CRM System — One Stop Shop Portal është aktivizuar.</p>"
        ),
        ["SubscriptionExpiringSoon"] = (
            "Abonimi skadon së shpejti",
            "<p>Abonimi juaj skadon së shpejti. Kontaktoni ekipin CRM System — One Stop Shop Portal për vazhdim.</p>"
        ),
        ["SubscriptionExpired"] = (
            "Abonimi ka skaduar",
            "<p>Abonimi juaj CRM System — One Stop Shop Portal ka skaduar.</p>"
        ),
        ["SubscriptionCancelled"] = (
            "Abonimi u anulua",
            "<p>Abonimi juaj CRM System — One Stop Shop Portal është anuluar.</p>"
        ),
        ["ContactRequestConfirmation"] = (
            "Kërkesa u pranua",
            "<p>E pranuam kërkesën tuaj. Ekipi do të përgjigjet brenda dy ditësh pune.</p>"
        ),
        ["ContactRequestResponse"] = (
            "Përgjigje nga CRM System — One Stop Shop Portal",
            "<p>Ekipi CRM System — One Stop Shop Portal dërgoi përgjigje për kërkesën tuaj:</p>"
        ),
        ["RegistrationInvitation"] = (
            "Ftesë për regjistrim",
            "<p>Krijoni llogari CRM System — One Stop Shop Portal për të vazhduar me shërbimin.</p>"
        ),
        ["TicketCreated"] = (
            "Tiketa u krijua",
            "<p>Tiketa juaj u krijua me sukses në portalin CRM System — One Stop Shop Portal.</p>"
        ),
        ["TicketAssigned"] = (
            "Tiketa u caktua",
            "<p>Tiketa juaj iu caktua një anëtari të ekipit CRM System — One Stop Shop Portal.</p>"
        ),
        ["TicketStatusChanged"] = (
            "Statusi i tiketës ndryshoi",
            "<p>Statusi i tiketës suaj ka ndryshuar. Hapni portalin për hollësi.</p>"
        ),
        ["TicketMessageCreated"] = (
            "Mesazh i ri në tiketë",
            "<p>Keni një mesazh të ri në tiketën tuaj CRM System — One Stop Shop Portal.</p>"
        ),
        ["TicketResolved"] = (
            "Tiketa u zgjidh",
            "<p>Tiketa është shënuar si e zgjidhur. Shikoni rekomandimin përfundimtar në portal.</p>"
        ),
        ["MeetingRequested"] = ("Takimi u kërkua", "<p>Kërkesa juaj për takim u pranua.</p>"),
        ["MeetingConfirmed"] = (
            "Takimi u konfirmua",
            "<p>Takimi juaj CRM System — One Stop Shop Portal u konfirmua. Hollësitë janë në portal.</p>"
        ),
        ["MeetingRejected"] = (
            "Takimi u refuzua",
            "<p>Kërkesa për takim nuk u konfirmua. Hapni portalin për hollësi.</p>"
        ),
        ["MeetingCancelled"] = ("Takimi u anulua", "<p>Takimi është anuluar.</p>"),
        ["MeetingCompleted"] = ("Takimi përfundoi", "<p>Takimi është shënuar si i përfunduar.</p>"),
    };

    public static (string Subject, string Body) Render(
        string type,
        string? language,
        string originalSubject,
        string originalBody,
        string brandName = "CRM System — One Stop Shop Portal"
    )
    {
        brandName = string.IsNullOrWhiteSpace(brandName) ? "CRM System — One Stop Shop Portal" : brandName.Trim();
        var htmlBrandName = System.Net.WebUtility.HtmlEncode(brandName);
        if (type == "AdminUserCreated")
            return ($"{brandName} - {originalSubject}", originalBody.Replace("CRM System — One Stop Shop Portal", htmlBrandName));

        var locale = language is "en" or "sq" ? language : "mk";
        if (locale == "en")
            return (
                $"{brandName} - {originalSubject}",
                $"<p>{htmlBrandName} notification: <strong>{originalSubject}</strong></p>{originalBody.Replace("CRM System — One Stop Shop Portal", htmlBrandName)}"
            );
        var templates = locale == "sq" ? Albanian : Macedonian;
        if (!templates.TryGetValue(type, out var template))
            return ($"{brandName} - {originalSubject}", originalBody.Replace("CRM System — One Stop Shop Portal", htmlBrandName));
        var body = template.Body.Replace("CRM System — One Stop Shop Portal", htmlBrandName);
        // The generic per-type template above is only a short, branded intro line — the
        // case-specific details (reference numbers, selected services, PDF attachments,
        // meeting times, links, etc.) live in the notification's own originalBody, built
        // by whichever feature created it. Always keep that content too, instead of
        // discarding it — this used to only happen for "ContactRequestResponse", which
        // silently dropped attachments/details for every other notification type.
        body += originalBody;
        return (
            $"{brandName} - {template.Subject}",
            $"<p><strong>{template.Subject}</strong></p>{body}"
        );
    }

    [GeneratedRegex("href=[\\\"']([^\\\"']+)[\\\"']", RegexOptions.IgnoreCase)]
    private static partial Regex LinkRegex();
}
