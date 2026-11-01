using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using StudioPlatform.Shared.Caching;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Messaging;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Tenancy;

namespace StudioPlatform.Modules.Auth;

public sealed class AuthIdentity : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = ["Customer"];
    public DateTime? LastLoginAtUtc { get; set; }
}

public interface IEmailSender
{
    Task SendOtpAsync(string email, string code, CancellationToken cancellationToken);
}

public sealed class ConsoleDevelopmentEmailSender(
    ILogger<ConsoleDevelopmentEmailSender> logger,
    IRedisCacheService cache) : IEmailSender
{
    public async Task SendOtpAsync(string email, string code, CancellationToken cancellationToken)
    {
        logger.LogInformation("Passwordless OTP for {Email}: {Code}", email, code);
        await cache.SetAsync($"auth:otp:dev:{email.ToLowerInvariant()}", code, TimeSpan.FromMinutes(10));
    }
}

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    public async Task SendOtpAsync(string email, string code, CancellationToken cancellationToken)
    {
        using var client = new SmtpClient(configuration["Smtp:Host"])
        {
            Port = configuration.GetValue("Smtp:Port", 587),
            EnableSsl = true,
            Credentials = new NetworkCredential(
                configuration["Smtp:Username"], configuration["Smtp:Password"])
        };
        using var message = new MailMessage(
            configuration["Smtp:From"] ?? throw new InvalidOperationException("Smtp:From is required."),
            email,
            "Your StudioPlatform login code",
            $"Your one-time login code is {code}. It expires in 10 minutes.");
        await client.SendMailAsync(message, cancellationToken);
    }
}

public interface IOtpService
{
    Task<string> RequestAsync(Guid businessId, string email, CancellationToken cancellationToken);
    Task<bool> VerifyAsync(Guid businessId, string email, string code, CancellationToken cancellationToken);
}

public sealed class RedisOtpService(IRedisCacheService cache) : IOtpService
{
    public async Task<string> RequestAsync(Guid businessId, string email, CancellationToken cancellationToken)
    {
        var normalized = email.ToLowerInvariant();
        var requestKey = $"auth:otp:requests:{businessId}:{normalized}";
        var requests = await cache.GetAsync<int?>(requestKey) ?? 0;
        if (requests >= 3)
            throw new InvalidOperationException("OTP request rate limit exceeded.");
        await cache.SetAsync(requestKey, requests + 1, TimeSpan.FromMinutes(5));

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
        await cache.SetAsync($"auth:otp:{businessId}:{normalized}", hash, TimeSpan.FromMinutes(10));
        await cache.SetAsync($"auth:otp:attempts:{businessId}:{normalized}", 0, TimeSpan.FromMinutes(10));
        return code;
    }

    public async Task<bool> VerifyAsync(Guid businessId, string email, string code, CancellationToken cancellationToken)
    {
        var normalized = email.ToLowerInvariant();
        var key = $"auth:otp:{businessId}:{normalized}";
        var storedHash = await cache.GetAsync<string>(key);
        if (storedHash is null) return false;
        var suppliedHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
        if (CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(storedHash), Encoding.UTF8.GetBytes(suppliedHash)))
        {
            await cache.RemoveAsync(key);
            await cache.RemoveAsync($"auth:otp:attempts:{businessId}:{normalized}");
            return true;
        }

        var attemptsKey = $"auth:otp:attempts:{businessId}:{normalized}";
        var attempts = (await cache.GetAsync<int?>(attemptsKey) ?? 0) + 1;
        if (attempts >= 5) await cache.RemoveAsync(key);
        await cache.SetAsync(attemptsKey, attempts, TimeSpan.FromMinutes(10));
        return false;
    }
}

public sealed record RequestCodeRequest(string Email, string Scope);
public sealed record VerifyCodeRequest(string Email, string Code);

public sealed class AuthModule : IModule
{
    public void RegisterModule(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMongoRepository<AuthIdentity>("studio_auth");
        services.AddSingleton<IOtpService, RedisOtpService>();
        services.AddSingleton<IEmailSender>(provider =>
            string.Equals(configuration["Email:Provider"], "smtp", StringComparison.OrdinalIgnoreCase)
                ? new SmtpEmailSender(configuration)
                : provider.GetRequiredService<ConsoleDevelopmentEmailSender>());
        services.AddSingleton<ConsoleDevelopmentEmailSender>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/request-code", RequestCodeAsync);
        endpoints.MapPost("/api/auth/verify-code", VerifyCodeAsync);
        endpoints.MapGet("/api/auth/me", (ClaimsPrincipal user) =>
                Results.Ok(user.Claims.GroupBy(claim => claim.Type)
                    .ToDictionary(group => group.Key, group => group.Select(claim => claim.Value).ToArray())))
            .RequireAuthorization();
    }

    private static async Task<IResult> RequestCodeAsync(
        RequestCodeRequest request, ITenantProvider tenant, IOtpService otp,
        IRedisCacheService cache,
        IEmailSender emailSender, CancellationToken cancellationToken)
    {
        if (tenant.BusinessId is not Guid businessId ||
            !Regex.IsMatch(request.Email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$") ||
            request.Scope is not ("customer" or "employee"))
            return Results.BadRequest("Valid business, email, and scope are required.");
        try
        {
            var code = await otp.RequestAsync(businessId, request.Email, cancellationToken);
            await cache.SetAsync(
                $"auth:otp:scope:{businessId}:{request.Email.ToLowerInvariant()}",
                request.Scope, TimeSpan.FromMinutes(10));
            await emailSender.SendOtpAsync(request.Email, code, cancellationToken);
            return Results.Ok(new { message = "Code sent." });
        }
        catch (InvalidOperationException exception)
        {
            return Results.Problem(exception.Message, statusCode: StatusCodes.Status429TooManyRequests);
        }
    }

    private static async Task<IResult> VerifyCodeAsync(
        VerifyCodeRequest request, ITenantProvider tenant, IOtpService otp,
        IMongoRepository<AuthIdentity> identities, IEventBus eventBus,
        IRedisCacheService cache,
        IConfiguration configuration, CancellationToken cancellationToken)
    {
        if (tenant.BusinessId is not Guid businessId ||
            !await otp.VerifyAsync(businessId, request.Email, request.Code, cancellationToken))
            return Results.BadRequest("Invalid or expired code.");

        var email = request.Email.ToLowerInvariant();
        var scope = await cache.GetAsync<string>(
            $"auth:otp:scope:{businessId}:{email}");
        var identity = await identities.FirstOrDefaultAsync(
            item => item.BusinessId == businessId && item.Email == email, cancellationToken);
        if (identity is null)
        {
            identity = new AuthIdentity
            {
                Id = Guid.NewGuid(), BusinessId = businessId, Email = email,
                Roles = [scope == "employee" ? "Employee" : "Customer"]
            };
            await identities.InsertAsync(identity, cancellationToken);
        }
        await cache.RemoveAsync($"auth:otp:scope:{businessId}:{email}");
        identity.LastLoginAtUtc = DateTime.UtcNow;
        await identities.ReplaceAsync(identity, cancellationToken);
        var role = identity.Roles.FirstOrDefault() ?? "Customer";
        await eventBus.PublishAsync(
            new UserAuthenticatedIntegrationEvent(identity.Id, businessId, email, role),
            cancellationToken);

        var secret = configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret is not configured.");
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, identity.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("business_id", businessId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };
        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                SecurityAlgorithms.HmacSha256));
        return Results.Ok(new
        {
            accessToken = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token),
            expiresAt = token.ValidTo,
            user = identity
        });
    }
}
