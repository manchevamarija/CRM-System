using System.Text.Json;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Application.Realtime;
using CRMSystem.Api.Web;
using CRMSystem.Api.Web.Middleware;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Configuration.AddInMemoryCollection(
    new Dictionary<string, string?>
    {
        ["Jwt:Key"] =
            builder.Configuration["JWT_SIGNING_KEY"] ?? "development-only-key-change-me-32chars",
        ["Jwt:Issuer"] = "crm-system",
        ["Jwt:Audience"] = "crm-system-clients",
    }
);

builder.Services.AddPortalInfrastructure(builder.Configuration, builder.Environment);
var dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, "data", "keys");
Directory.CreateDirectory(dataProtectionKeysPath);
builder.Services
    .AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("CRM System");
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddPortalHealthChecks();
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
var corsOrigins = configuredOrigins
    .Concat([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ])
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy
            .WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
    )
);

var app = builder.Build();
ProductionValidation.Ensure(app.Configuration, app.Environment);
if (app.Environment.IsProduction())
{
    var forwarded = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        ForwardLimit = 1,
    };
    forwarded.KnownIPNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UsePortalExceptionHandling();
app.Use(
    async (context, next) =>
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        context.Response.Headers["Content-Security-Policy"] =
            "default-src 'self'; frame-ancestors 'none'";
        await next();
    }
);
if (!app.Environment.IsEnvironment("Testing"))
    app.UseRateLimiter();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<ActiveUserMiddleware>();
app.UseMiddleware<TenantStaffAccessMiddleware>();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "CRM System API v1");
        options.RoutePrefix = "swagger";
    });
}
static Task WriteHealthResponse(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json; charset=utf-8";
    return context.Response.WriteAsync(
        JsonSerializer.Serialize(
            new
            {
                status = report.Status.ToString(),
                durationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 2),
                checks = report.Entries.ToDictionary(
                    x => x.Key,
                    x => new
                    {
                        status = x.Value.Status.ToString(),
                        description = x.Value.Description,
                        durationMs = Math.Round(x.Value.Duration.TotalMilliseconds, 2),
                        data = x.Value.Data,
                    }
                ),
            }
        )
    );
}
app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = WriteHealthResponse });
app.MapHealthChecks(
    "/health/live",
    new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("live"),
        ResponseWriter = WriteHealthResponse,
    }
);
app.MapHealthChecks(
    "/health/ready",
    new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = WriteHealthResponse,
    }
);

await app.Services.InitializePortalAsync();
app.MapControllers();
app.MapHub<TicketHub>("/hubs/tickets").RequireAuthorization();
app.MapHub<CrmHub>("/hubs/crm").RequireAuthorization();

app.Run();

public partial class Program;
