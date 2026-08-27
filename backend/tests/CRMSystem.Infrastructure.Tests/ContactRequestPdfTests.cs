using System.Text;
using CRMSystem.Domain.Entities;
using CRMSystem.Infrastructure.Services;
using Xunit;

namespace CRMSystem.Infrastructure.Tests;

public sealed class ContactRequestPdfTests
{
    [Theory]
    [InlineData("mk")]
    [InlineData("en")]
    [InlineData("sq")]
    public void Confirmation_pdf_is_generated_for_every_supported_client_language(string language)
    {
        var request = new ContactRequest
        {
            ContactName = "Test Client",
            Email = "client@example.test",
            OrganizationName = "Test Organization",
            PreferredLanguage = language,
        };

        var pdf = ContactRequestService.BuildCurrentPdfBytes(
            request,
            ["Дигитална стратегија", "Обуки за тимови"],
            "CRM System");

        Assert.True(pdf.Length > 5_000);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
