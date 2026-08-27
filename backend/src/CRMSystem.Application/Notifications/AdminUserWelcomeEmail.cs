using System.Net;
using CRMSystem.Domain.Entities;

namespace CRMSystem.Application;

public static class AdminUserWelcomeEmail
{
    public static Notification Create(AppUser user, string activationUrl)
    {
        var language = user.PreferredLanguage is "en" or "sq" ? user.PreferredLanguage : "mk";
        var email = WebUtility.HtmlEncode(user.Email ?? string.Empty);
        var link = WebUtility.HtmlEncode(activationUrl);
        var (subject, greeting, intro, emailLabel, warning, action) = language switch
        {
            "en" => (
                "Your CRM System access",
                $"Hello {WebUtility.HtmlEncode(user.FirstName)},",
                "An administrator created your CRM System account.",
                "Login email",
                "Set your own password using the secure activation link below.",
                "Activate your CRM account"
            ),
            "sq" => (
                "Qasja juaj në CRM System",
                $"Përshëndetje {WebUtility.HtmlEncode(user.FirstName)},",
                "Administratori krijoi llogarinë tuaj në CRM System.",
                "Emaili për hyrje",
                "Vendosni fjalëkalimin tuaj përmes lidhjes së sigurt të aktivizimit më poshtë.",
                "Aktivizoni llogarinë CRM"
            ),
            _ => (
                "Вашиот пристап до CRM System",
                $"Здраво {WebUtility.HtmlEncode(user.FirstName)},",
                "Администраторот ја креираше вашата сметка во CRM System.",
                "Е-пошта за најава",
                "Поставете своја лозинка преку безбедната врска за активација подолу.",
                "Активирајте CRM профил"
            ),
        };

        return new Notification
        {
            RecipientUserId = user.Id,
            RecipientEmail = user.Email,
            Language = language,
            Type = "AdminUserCreated",
            Subject = subject,
            Body = $"""
                <p>{greeting}</p>
                <p>{intro}</p>
                <p><strong>{emailLabel}:</strong> {email}</p>
                <p>{warning}</p>
                <p><a href="{link}">{action}</a></p>
                """,
            ActionUrl = activationUrl,
        };
    }
}
