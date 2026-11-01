using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using StudioPlatform.Shared.Caching;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Email;
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

public sealed record RequestCodeRequest(string Email, string? Scope = "customer");
public sealed record VerifyCodeRequest(string Email, string Code);
public sealed record RefreshTokenRequest(string? RefreshToken);
public sealed record RefreshTokenSession(Guid UserId, Guid BusinessId, string Email, string Role);

public sealed class AuthModule : IModule
{
    public void RegisterModule(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMongoRepository<AuthIdentity>("studio_auth");
        services.AddMongoRepository<UserProfile>("studio_auth");
        services.AddSingleton<IOtpService, RedisOtpService>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/auth/request-code", RequestCodeAsync);
        endpoints.MapPost("/api/auth/otp/request", RequestCodeAsync);
        endpoints.MapPost("/api/auth/verify-code", VerifyCodeAsync);
        endpoints.MapPost("/api/auth/otp/verify", VerifyCodeAsync);
        endpoints.MapPost("/api/auth/refresh", RefreshAsync);
        endpoints.MapGet("/api/auth/me", (ClaimsPrincipal user) =>
                Results.Ok(user.Claims.GroupBy(claim => claim.Type)
                    .ToDictionary(group => group.Key, group => group.Select(claim => claim.Value).ToArray())))
            .RequireAuthorization();
        endpoints.MapGet("/api/onboarding/profile", GetProfileAsync).RequireAuthorization();
        endpoints.MapPut("/api/onboarding/profile", SaveProfileAsync).RequireAuthorization();
    }

    private static async Task<IResult> GetProfileAsync(
        ClaimsPrincipal user, IMongoRepository<UserProfile> profiles,
        CancellationToken cancellationToken)
    {
        var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        if (string.IsNullOrWhiteSpace(email)) return Results.Unauthorized();
        var profile = await profiles.FirstOrDefaultAsync(
            item => item.Email == email.ToLowerInvariant(), cancellationToken);
        return profile is null ? Results.NotFound() : Results.Ok(profile);
    }

    private static async Task<IResult> SaveProfileAsync(
        UserProfile input, ClaimsPrincipal user, IMongoRepository<UserProfile> profiles,
        CancellationToken cancellationToken)
    {
        var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        var subject = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(email) || !Guid.TryParse(subject, out var id))
            return Results.Unauthorized();
        var normalizedEmail = email.ToLowerInvariant();
        var profile = await profiles.FirstOrDefaultAsync(
            item => item.Email == normalizedEmail, cancellationToken) ?? new UserProfile
            {
                Id = id,
                Email = normalizedEmail
            };
        profile.FirstName = input.FirstName.Trim();
        profile.LastName = input.LastName.Trim();
        profile.Phone = input.Phone?.Trim();
        profile.Address = input.Address;
        profile.OnboardingCompleted = !string.IsNullOrWhiteSpace(profile.FirstName) &&
            !string.IsNullOrWhiteSpace(profile.LastName);
        if (profile.Id == id && await profiles.GetByIdAsync(id, cancellationToken) is null)
            await profiles.InsertAsync(profile, cancellationToken);
        else
            await profiles.ReplaceAsync(profile, cancellationToken);
        return Results.Ok(profile);
    }

    private static async Task<IResult> RequestCodeAsync(
        RequestCodeRequest request, ITenantProvider tenant, IOtpService otp,
        IRedisCacheService cache,
        IEmailSender emailSender, IMongoRepository<AuthIdentity> identities,
        IHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        var businessId = tenant.BusinessId ?? Guid.Empty;
        var scope = string.IsNullOrWhiteSpace(request.Scope) ? "customer" : request.Scope;
        if (!Regex.IsMatch(request.Email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$") ||
            scope is not ("customer" or "employee" or "business-admin" or "developer"))
            return Results.BadRequest("Valid business, email, and scope are required.");
        if (scope == "developer" &&
            await identities.FirstOrDefaultAsync(
                identity => identity.BusinessId == Guid.Empty &&
                    identity.Email == request.Email.ToLowerInvariant() &&
                    identity.Roles.Contains("Developer"),
                cancellationToken) is null)
            return Results.Forbid();
        try
        {
            var code = await otp.RequestAsync(businessId, request.Email, cancellationToken);
            await cache.SetAsync(
                $"auth:otp:scope:{businessId}:{request.Email.ToLowerInvariant()}",
                scope, TimeSpan.FromMinutes(10));
            await emailSender.SendOtpAsync(request.Email, code, cancellationToken);
            return environment.IsDevelopment()
                ? Results.Ok(new { message = "Code sent.", developmentCode = code })
                : Results.Ok(new { message = "Code sent." });
        }
        catch (InvalidOperationException exception)
        {
            return Results.Problem(exception.Message, statusCode: StatusCodes.Status429TooManyRequests);
        }
    }

    private static async Task<IResult> VerifyCodeAsync(
        VerifyCodeRequest request, HttpContext httpContext, ITenantProvider tenant, IOtpService otp,
        IMongoRepository<AuthIdentity> identities, IEventBus eventBus,
        IRedisCacheService cache,
        IConfiguration configuration, CancellationToken cancellationToken)
    {
        var businessId = tenant.BusinessId ?? Guid.Empty;
        if (!await otp.VerifyAsync(businessId, request.Email, request.Code, cancellationToken))
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
                Id = Guid.NewGuid(),
                BusinessId = businessId,
                Email = email,
                Roles = [scope switch
                {
                    "developer" => "Developer",
                    "employee" => "Employee",
                    "business-admin" => "BusinessAdmin",
                    _ => "Customer"
                }]
            };
            await identities.InsertAsync(identity, cancellationToken);
        }
        if (scope == "developer" &&
            (identity is null || !identity.Roles.Contains("Developer")))
            return Results.Forbid();
        await cache.RemoveAsync($"auth:otp:scope:{businessId}:{email}");
        identity.LastLoginAtUtc = DateTime.UtcNow;
        await identities.ReplaceAsync(identity, cancellationToken);
        var role = identity.Roles.FirstOrDefault() ?? "Customer";
        await eventBus.PublishAsync(
            new UserAuthenticatedIntegrationEvent(identity.Id, businessId, email, role),
            cancellationToken);

        var secret = configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret must be configured.");
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, identity.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("business_id", businessId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };
        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                SecurityAlgorithms.HmacSha256));

        // Generate and persist refresh token (WMS-004)
        var refreshToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var refreshSession = new RefreshTokenSession(identity.Id, businessId, email, role);
        await cache.SetAsync($"auth:refresh:{refreshToken}", refreshSession, TimeSpan.FromDays(7));

        httpContext.Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });

        return Results.Ok(new
        {
            accessToken = new JwtSecurityTokenHandler().WriteToken(token),
            refreshToken,
            expiresAt = token.ValidTo,
            user = identity
        });
    }

    private static async Task<IResult> RefreshAsync(
        RefreshTokenRequest? request,
        HttpContext httpContext,
        IRedisCacheService cache,
        IMongoRepository<AuthIdentity> identities,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var token = request?.RefreshToken ?? httpContext.Request.Cookies["refreshToken"];
        if (string.IsNullOrWhiteSpace(token))
        {
            return Results.Unauthorized();
        }

        var key = $"auth:refresh:{token}";
        var session = await cache.GetAsync<RefreshTokenSession>(key);
        if (session is null)
        {
            return Results.Unauthorized();
        }

        // Rotate refresh token
        await cache.RemoveAsync(key);

        var identity = await identities.GetByIdAsync(session.UserId, cancellationToken)
            ?? await identities.FirstOrDefaultAsync(x => x.Email == session.Email, cancellationToken);
        if (identity is null)
        {
            return Results.Unauthorized();
        }

        var role = identity.Roles.FirstOrDefault() ?? session.Role;
        var newRefreshToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var newSession = new RefreshTokenSession(identity.Id, session.BusinessId, identity.Email, role);
        await cache.SetAsync($"auth:refresh:{newRefreshToken}", newSession, TimeSpan.FromDays(7));

        httpContext.Response.Cookies.Append("refreshToken", newRefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });

        var secret = configuration["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret must be configured.");
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, identity.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, identity.Email),
            new Claim("business_id", session.BusinessId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };
        var jwt = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                SecurityAlgorithms.HmacSha256));

        return Results.Ok(new
        {
            accessToken = new JwtSecurityTokenHandler().WriteToken(jwt),
            refreshToken = newRefreshToken,
            expiresAt = jwt.ValidTo,
            user = identity
        });
    }
}
