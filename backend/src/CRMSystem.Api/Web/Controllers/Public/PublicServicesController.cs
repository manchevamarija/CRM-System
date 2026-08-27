using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application;
using Microsoft.AspNetCore.Mvc;

namespace CRMSystem.Api.Web.Controllers.Public;

[ApiController]
[Route("api/public/services")]
public sealed class PublicServicesController(IPublicContentService service) : ControllerBase
{
    [HttpGet]
    public async Task<IResult> GetServices(string? language, CancellationToken ct) =>
        Results.Ok(await service.GetServicesAsync(language, ct));
}
