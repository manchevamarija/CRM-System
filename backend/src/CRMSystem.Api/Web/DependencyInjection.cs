using System.Text;
using System.Threading.RateLimiting;
using CRMSystem.Infrastructure.Persistence;
using CRMSystem.Infrastructure.Persistence.Repositories;
using CRMSystem.Infrastructure.Services;
using CRMSystem.Infrastructure.Identity;
using CRMSystem.Application;
using CRMSystem.Application.Jobs;
using CRMSystem.Application.Realtime;
using CRMSystem.Application.Tenancy;
using CRMSystem.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CRMSystem.Api.Web;

public static class DependencyInjection
{
    public static IServiceCollection AddPortalInfrastructure(
        this IServiceCollection services,
        IConfiguration config,
        IHostEnvironment environment
    )
    {
        services.AddHttpContextAccessor();
        // Scoped on purpose: the implementation can later resolve a tenant from the
        // verified request host or token without changing consumers.
        services.AddScoped<ITenantContext, ConfigurationTenantContext>();
        services.AddSingleton<ITenantDirectory, ConfigurationTenantDirectory>();
        var cs = config.GetConnectionString("Portal");
        services.AddDbContext<PortalDbContext>(options =>
        {
            if (!string.IsNullOrWhiteSpace(cs))
            {
                options.UseNpgsql(cs);
            }
            else
            {
                var databasePath = Path.GetFullPath(
                    config["LocalDatabasePath"] ?? "data/crm-system-dev.db"
                );
                Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
                options.UseSqlite($"Data Source={databasePath}");
            }
        });
        // General-purpose escape hatch for any future Application service that needs a
        // broader query than a dedicated repository method covers (see
        // Application/Abstractions/IPortalDbContext.cs). TicketService, MeetingService,
        // ContactRequestService and PublicContentService use the narrower repository
        // interfaces registered below instead.
        services.AddScoped<IPortalDbContext>(sp => sp.GetRequiredService<PortalDbContext>());
        services.AddScoped<ITicketRepository, TicketRepository>();
        services.AddScoped<IMeetingRepository, MeetingRepository>();
        services.AddScoped<IContactRequestRepository, ContactRequestRepository>();
        services.AddScoped<IPublicContentRepository, PublicContentRepository>();
        services.AddScoped<IPublicContentService, PublicContentService>();
        services
            .AddIdentityCore<AppUser>(o =>
            {
                o.User.RequireUniqueEmail = true;
                o.Password.RequiredLength = 10;
                o.SignIn.RequireConfirmedEmail = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<PortalDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();
        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = config["Jwt:Issuer"],
                    ValidAudience = config["Jwt:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(config["Jwt:Key"]!)
                    ),
                    ClockSkew = TimeSpan.FromMinutes(1),
                };
                o.Events = new JwtBearerEvents
                {
                    OnMessageReceived = c =>
                    {
                        if (
                            c.Request.Query.TryGetValue("access_token", out var token)
                            && c.HttpContext.Request.Path.StartsWithSegments("/hubs")
                        )
                            c.Token = token;
                        return Task.CompletedTask;
                    },
                };
            });
        services.AddAuthorization(o =>
        {
            o.AddPolicy("Staff", p => p.RequireRole("Admin", "HelpDeskAgent", "Expert"));
            o.AddPolicy("Admin", p => p.RequireRole("Admin"));
        });
        services.AddScoped<ITokenService, TokenService>();
        services.AddSingleton<ITemporaryPasswordGenerator, TemporaryPasswordGenerator>();
        services.AddScoped<IEmailSender, BrevoEmailSender>();
        services.AddSingleton<IFileScanner, ClamAvFileScanner>();
        services.AddScoped<IFileStorage, DiskFileStorage>();
        services.AddScoped<IContactRequestService, ContactRequestService>();
        services.AddScoped<ITicketService, TicketService>();
        services.AddScoped<IMeetingService, MeetingService>();
        services.AddScoped<IRealtimeTicketNotifier, SignalRTicketNotifier>();
        services.AddSingleton<TicketPresenceTracker>();
        services.AddSignalR();
        services.AddPortalScheduledJobs(environment);
        var sensitivePermitLimit =
            config.GetValue<int?>("RateLimit:SensitivePermitLimit")
            ?? (environment.IsDevelopment() ? 1000 : 10);
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = 429;
            o.AddPolicy(
                "sensitive",
                c =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        c.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = sensitivePermitLimit,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        }
                    )
            );
        });
        return services;
    }
}
