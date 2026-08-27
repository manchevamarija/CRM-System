using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace CRMSystem.Infrastructure.Services;

/// <summary>
/// Owns the printable representation of a CRM request. Keeping document rendering outside the
/// request workflow makes the same PDF usable for every tenant and for future delivery channels.
/// </summary>
internal static class ContactRequestPdfRenderer
{
    public static string BuildAttachment(
        ContactRequest item,
        IEnumerable<string> services,
        string filePrefix,
        bool isUpdate,
        string brandName)
    {
        var reference = Reference(item);
        var pdf = Build(item, services.ToArray(), reference, isUpdate, brandName, null);
        return Attachment($"{filePrefix}-{reference}.pdf", pdf);
    }

    public static string BuildHandoverAttachment(
        ContactRequest item,
        IEnumerable<string> services,
        string fromTenant,
        string toTenant,
        string reason)
        => Attachment(
            $"CRM-primopredavanje-{Reference(item)}.pdf",
            BuildHandover(item, services, fromTenant, toTenant, reason));

    public static byte[] BuildHandover(
        ContactRequest item,
        IEnumerable<string> services,
        string fromTenant,
        string toTenant,
        string reason)
        => Build(
            item,
            services.ToArray(),
            Reference(item),
            true,
            toTenant,
            new HandoverContext(
                fromTenant,
                toTenant,
                reason,
                item.OwnershipTransferredAt ?? DateTimeOffset.UtcNow));

    public static byte[] BuildCurrent(
        ContactRequest item,
        IEnumerable<string> services,
        string brandName)
        => Build(item, services.ToArray(), Reference(item), true, brandName, null);

    private static byte[] Build(
        ContactRequest item,
        string[] services,
        string reference,
        bool isUpdate,
        string brandName,
        HandoverContext? handover)
    {
        var language = NormalizeLanguage(item.PreferredLanguage);
        QuestPDF.Settings.License = LicenseType.Community;
        return Document
            .Create(document =>
                document.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.MarginHorizontal(52);
                    page.MarginVertical(40);
                    page.DefaultTextStyle(style => style.FontSize(9.5f).FontColor(PdfInk));
                    ComposeHeader(page);
                    ComposeContent(page, item, services, reference, isUpdate, brandName, handover, language);
                    ComposeFooter(page, reference, brandName, language);
                }))
            .GeneratePdf();
    }

    private static void ComposeHeader(PageDescriptor page)
    {
        page.Header().Column(header =>
        {
            header.Item().Width(185).Height(42).Svg(CrmLogoSvg);
            header.Item().PaddingTop(14).LineHorizontal(1).LineColor(PdfGold);
        });
    }

    private static void ComposeContent(
        PageDescriptor page,
        ContactRequest item,
        string[] services,
        string reference,
        bool isUpdate,
        string brandName,
        HandoverContext? handover,
        string language)
    {
        page.Content().PaddingTop(14).Column(content =>
        {
            content.Spacing(7);
            ComposeTitle(content, item, reference, isUpdate, language);
            ComposeRequestDetails(content, item, reference, language);
            if (handover is not null)
                ComposeHandover(content, handover, language);
            ComposeServices(content, services, language);
            ComposeNextSteps(content, language);
            ComposeSignOff(content, brandName, language);
        });
    }

    private static void ComposeTitle(
        ColumnDescriptor content,
        ContactRequest item,
        string reference,
        bool isUpdate,
        string language)
    {
        content.Item().Text(isUpdate
                ? Text(language, "АЖУРИРАНА ПОТВРДА", "UPDATED CONFIRMATION", "KONFIRMIM I PËRDITËSUAR")
                : Text(language, "ПОТВРДА", "CONFIRMATION", "KONFIRMIM"))
            .SemiBold().FontSize(8.5f).FontColor(PdfMuted);
        content.Item().Text(isUpdate
                ? Text(language, "Ажурирана потврда за услуга", "Updated Service Confirmation", "Konfirmim i Përditësuar i Shërbimit")
                : Text(language, "Потврда за побарани услуги", "Confirmation of Requested Services", "Konfirmim për Shërbimet e Kërkuara"))
            .Bold().FontSize(18).FontColor(PdfNavy);
        content.Item().Text(text =>
        {
            text.Span($"{Text(language, "Референца", "Reference", "Referenca")}: ").SemiBold().FontColor(PdfMuted);
            text.Span(reference).Bold().FontColor(PdfTeal);
        });
        content.Item().PaddingTop(8)
            .Text($"{Text(language, "Почитуван/а", "Dear", "I/E nderuar")} {item.ContactName},")
            .FontSize(11);
        content.Item().Text(isUpdate
            ? Text(language,
                "Во прилог е најновиот статус на услугите за вашето барање. Овој документ е автоматски генериран и уникатен за вашето барање.",
                "Attached is the latest status of services for your request. This document is generated automatically and is unique to your request.",
                "Bashkëngjitur gjendet statusi më i fundit i shërbimeve për kërkesën tuaj. Ky dokument gjenerohet automatikisht dhe është unik për kërkesën tuaj.")
            : Text(language,
                "Вашето барање е успешно евидентирано. Овој документ е автоматски генериран и уникатен за вашето барање.",
                "Your request has been recorded successfully. This document is generated automatically and is unique to your request.",
                "Kërkesa juaj është regjistruar me sukses. Ky dokument gjenerohet automatikisht dhe është unik për kërkesën tuaj."));
    }

    private static void ComposeRequestDetails(
        ColumnDescriptor content,
        ContactRequest item,
        string reference,
        string language)
    {
        content.Item().PaddingTop(8).Element(container => SectionTitle(container,
            Text(language, "ПОДАТОЦИ ЗА БАРАЊЕТО", "REQUEST DETAILS", "TË DHËNAT E KËRKESËS")));
        content.Item().Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.RelativeColumn(); columns.RelativeColumn(); });
            table.Cell().Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "РЕФЕРЕНЦА", "REFERENCE", "REFERENCA"), reference, true));
            table.Cell().Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "ОРГАНИЗАЦИЈА", "ORGANIZATION", "ORGANIZATA"), item.OrganizationName));
            table.Cell().Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "КОНТАКТ", "CONTACT", "KONTAKTI"), $"{item.ContactName} — {item.Email}"));
            table.Cell().Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "ПОДНЕСЕНО", "SUBMITTED", "DATA E PARAQITJES"), $"{item.CreatedAt:dd.MM.yyyy} {item.CreatedAt:HH:mm}"));
        });
    }

    private static void ComposeHandover(ColumnDescriptor content, HandoverContext handover, string language)
    {
        content.Item().PaddingTop(5).Element(container => SectionTitle(container,
            Text(language, "ПРИМОПРЕДАВАЊЕ", "HANDOVER", "BARTJA E PËRGJEGJËSISË")));
        content.Item().Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.RelativeColumn(); columns.RelativeColumn(); });
            table.Cell().Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "ОД", "FROM", "NGA"), handover.FromTenant));
            table.Cell().Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "НОВ ОДГОВОРЕН ЦЕНТАР", "NEW RESPONSIBLE CENTRE", "QENDRA E RE PËRGJEGJËSE"), handover.ToTenant, true));
            table.Cell().ColumnSpan(2).Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "ПРИЧИНА", "REASON", "ARSYEJA"), handover.Reason));
            table.Cell().ColumnSpan(2).Element(InfoCell).Element(cell => InfoValue(cell,
                Text(language, "ДАТУМ НА ПРИМОПРЕДАВАЊЕ", "HANDOVER DATE", "DATA E BARTJES"), $"{handover.TransferredAt:dd.MM.yyyy} {handover.TransferredAt:HH:mm}"));
        });
        content.Item().Text(Text(language,
                "Барањето, услугите, документите и историјата продолжуваат под истата референца.",
                "The request, services, documents and history continue under the same reference.",
                "Kërkesa, shërbimet, dokumentet dhe historia vazhdojnë nën të njëjtën referencë."))
            .Italic().FontSize(8.5f).FontColor(PdfMuted);
    }

    private static void ComposeServices(ColumnDescriptor content, string[] services, string language)
    {
        content.Item().PaddingTop(5).Element(container => SectionTitle(container,
            Text(language, "ПОБАРАНИ УСЛУГИ", "REQUESTED SERVICES", "SHËRBIMET E KËRKUARA")));
        if (services.Length == 0)
        {
            content.Item().Text(Text(language,
                "Услугите ќе бидат дефинирани во консултација со нашиот тим.",
                "Services will be defined during a consultation with our team.",
                "Shërbimet do të përcaktohen gjatë konsultimit me ekipin tonë.")).Italic();
            return;
        }

        foreach (var service in services)
            content.Item().PaddingLeft(6).Text(text =>
            {
                text.Span("✓  ").Bold().FontSize(12).FontColor(PdfTeal);
                text.Span(LocalizeService(service, language));
            });
    }

    private static void ComposeNextSteps(ColumnDescriptor content, string language)
    {
        content.Item().PaddingTop(4).Border(1).BorderColor(PdfBorder).Background(PdfSoft)
            .PaddingVertical(10).PaddingHorizontal(14).Column(next =>
            {
                next.Spacing(4);
                next.Item().Text(Text(language, "Следен чекор", "Next Steps", "Hapi Tjetër"))
                    .Bold().FontSize(10.5f).FontColor(PdfNavy);
                next.Item().Text(Text(language,
                    "Нашиот тим ќе ве контактира во рок од два работни дена.",
                    "Our team will contact you within two business days.",
                    "Ekipi ynë do t'ju kontaktojë brenda dy ditëve pune."));
                next.Item().Text(Text(language,
                    "Статусот и дополнителните услуги може да ги следите преку клиентскиот портал.",
                    "You can track the status and any additional services through the client portal.",
                    "Statusin dhe shërbimet shtesë mund t'i ndiqni përmes portalit të klientit."));
            });
    }

    private static void ComposeSignOff(ColumnDescriptor content, string brandName, string language)
    {
        content.Item().PaddingTop(6).Column(signOff =>
        {
            signOff.Spacing(2);
            signOff.Item().Text(Text(language, "Со почит,", "Kind regards,", "Me respekt,"));
            signOff.Item().Text($"{Text(language, "Тимот на", "The", "Ekipi i")} {brandName}{(language == "en" ? " Team" : "")}")
                .Bold().FontColor(PdfNavy);
            signOff.Item().PaddingTop(7).Text(Text(language,
                    "Ова е автоматски генериран документ. Ве молиме не одговарајте директно на оваа порака.",
                    "This is an automatically generated document. Please do not reply directly to this message.",
                    "Ky është një dokument i gjeneruar automatikisht. Ju lutemi mos i përgjigjuni drejtpërdrejt këtij mesazhi."))
                .Italic().FontSize(7.5f).FontColor(PdfMuted);
        });
    }

    private static void ComposeFooter(PageDescriptor page, string reference, string brandName, string language)
    {
        page.Footer().BorderTop(1).BorderColor(PdfBorder).PaddingTop(8).AlignCenter().Text(text =>
        {
            text.DefaultTextStyle(style => style.FontSize(7.5f).FontColor(PdfMuted));
            text.Span(brandName);
            text.Span("  •  ");
            text.Span(reference).SemiBold();
            text.Span("  •  ");
            text.Span(Text(language,
                "Автоматски генерирана потврда",
                "Automatically generated confirmation",
                "Konfirmim i gjeneruar automatikisht"));
        });
    }

    private static string Attachment(string name, byte[] bytes)
        => $"<!--CRM_ATTACHMENT:{name}:application/pdf:{Convert.ToBase64String(bytes)}-->";

    private static string Reference(ContactRequest item)
        => $"CRM-{item.Id.ToString("N")[..8].ToUpperInvariant()}";

    private static void SectionTitle(IContainer container, string title)
        => container.PaddingBottom(4).BorderBottom(1).BorderColor(PdfGold)
            .Text(title).Bold().FontSize(9).FontColor(PdfNavy);

    private static IContainer InfoCell(IContainer container)
        => container.Border(0.6f).BorderColor(PdfBorder).MinHeight(38).PaddingVertical(7).PaddingHorizontal(8);

    private static void InfoValue(IContainer container, string label, string value, bool accent = false)
        => container.Column(column =>
        {
            column.Spacing(2);
            column.Item().Text(label).SemiBold().FontSize(7.5f).FontColor(PdfMuted);
            column.Item().Text(value).FontSize(9.5f).FontColor(accent ? PdfTeal : PdfInk);
        });

    private static string NormalizeLanguage(string? language) => language is "en" or "sq" ? language : "mk";
    private static string Text(string language, string mk, string en, string sq)
        => language == "en" ? en : language == "sq" ? sq : mk;

    private static string LocalizeService(string value, string language)
    {
        var translations = new Dictionary<string, (string En, string Sq)>(StringComparer.OrdinalIgnoreCase)
        {
            ["Дигитална стратегија"] = ("Digital strategy", "Strategji digjitale"),
            ["Веб и е-трговија"] = ("Web and e-commerce", "Ueb dhe tregti elektronike"),
            ["Автоматизација"] = ("Automation", "Automatizim"),
            ["Паметни дигитални решенија"] = ("Smart digital solutions", "Zgjidhje të mençura digjitale"),
            ["Дигитален маркетинг"] = ("Digital marketing", "Marketing digjital"),
            ["Обуки за тимови"] = ("Team training", "Trajnime për ekipe"),
        };
        if (language == "mk") return value;
        var separator = value.IndexOf(" · ", StringComparison.Ordinal);
        var name = separator < 0 ? value : value[..separator];
        var suffix = separator < 0 ? "" : value[separator..];
        if (!translations.TryGetValue(name, out var translated)) return value;
        return (language == "sq" ? translated.Sq : translated.En) + suffix;
    }

    private sealed record HandoverContext(
        string FromTenant,
        string ToTenant,
        string Reason,
        DateTimeOffset TransferredAt);

    private const string PdfNavy = "#173F5F";
    private const string PdfTeal = "#167D86";
    private const string PdfGold = "#D9951E";
    private const string PdfInk = "#263238";
    private const string PdfMuted = "#667B84";
    private const string PdfBorder = "#D6DEE1";
    private const string PdfSoft = "#F4F7F8";
    private const string CrmLogoSvg = """
        <svg xmlns="http://www.w3.org/2000/svg" width="286" height="64" viewBox="0 0 286 64">
          <defs><linearGradient id="g" x1="7" y1="7" x2="57" y2="57" gradientUnits="userSpaceOnUse"><stop stop-color="#173F5F"/><stop offset="1" stop-color="#267A82"/></linearGradient></defs>
          <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="url(#g)"/>
          <path d="M22 20.5h16.5l5 5v13l-5 5H22l-5-5v-13Z" fill="none" stroke="#fff" stroke-width="3"/>
          <path d="M27 27h10v10H27z" fill="none" stroke="#D9AB55" stroke-width="2.5"/>
          <text x="75" y="30" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#173F5F">CRM System</text>
          <text x="76" y="47" font-family="Consolas,monospace" font-size="8.5" font-weight="700" letter-spacing="1.7" fill="#647980">DIGITAL SERVICE PLATFORM</text>
          <path d="M76 55h164" stroke="#D9AB55" stroke-width="2"/><circle cx="245" cy="55" r="3" fill="#267A82"/>
        </svg>
        """;
}
