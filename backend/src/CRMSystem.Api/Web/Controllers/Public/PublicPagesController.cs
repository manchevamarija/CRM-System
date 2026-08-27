using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using Microsoft.AspNetCore.Mvc;

namespace CRMSystem.Api.Web.Controllers.Public;

[ApiController]
[Route("api/public/pages")]
public sealed class PublicPagesController(IPublicContentService service) : ControllerBase
{
    [HttpGet("{slug}")]
    public async Task<IResult> GetPage(string slug, string? language, CancellationToken ct)
    {
        var page = await service.GetPageAsync(slug, language, ct);
        return page is null ? Results.NotFound() : Results.Ok(page);
    }
}
