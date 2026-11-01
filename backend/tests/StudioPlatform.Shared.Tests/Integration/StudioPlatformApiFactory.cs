using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using StackExchange.Redis;
using StudioPlatform.Modules.Agenda;
using StudioPlatform.Modules.Auth;
using StudioPlatform.Modules.Business.Domain;
using StudioPlatform.Modules.Customers;
using StudioPlatform.Modules.Employees;
using StudioPlatform.Shared.Caching;
using StudioPlatform.Shared.Email;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Tests.Integration.Infrastructure;

namespace StudioPlatform.Shared.Tests.Integration;

public class StudioPlatformApiFactory : WebApplicationFactory<Program>
{
    public const string DefaultJwtSecret = "test-jwt-secret-at-least-32-chars-long-12345";
    public const string DefaultIssuer = "StudioPlatform";
    public const string DefaultAudience = "StudioPlatform.Web";

    static StudioPlatformApiFactory()
    {
        Environment.SetEnvironmentVariable("Jwt__Secret", DefaultJwtSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", DefaultIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", DefaultAudience);
        Environment.SetEnvironmentVariable("Jwt:Secret", DefaultJwtSecret);
        Environment.SetEnvironmentVariable("Jwt:Issuer", DefaultIssuer);
        Environment.SetEnvironmentVariable("Jwt:Audience", DefaultAudience);
    }

    public InMemoryRedisCacheService Cache { get; } = new();
    public TestEmailSender EmailSender { get; } = new();
    private readonly ConcurrentDictionary<Type, object> _repositories = new();

    public InMemoryMongoRepository<T> GetRepository<T>() where T : BaseEntity
    {
        return (InMemoryMongoRepository<T>)_repositories.GetOrAdd(
            typeof(T), _ => new InMemoryMongoRepository<T>());
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.UseSetting("Jwt:Secret", DefaultJwtSecret);
        builder.UseSetting("Jwt:Issuer", DefaultIssuer);
        builder.UseSetting("Jwt:Audience", DefaultAudience);
        builder.UseSetting("Jwt__Secret", DefaultJwtSecret);
        builder.UseSetting("Jwt__Issuer", DefaultIssuer);
        builder.UseSetting("Jwt__Audience", DefaultAudience);

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = DefaultJwtSecret,
                ["Jwt:Issuer"] = DefaultIssuer,
                ["Jwt:Audience"] = DefaultAudience,
                ["MongoDB:ConnectionString"] = "mongodb://localhost:27017",
                ["Redis:ConnectionString"] = "localhost:6379",
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove all hosted services that connect to external MongoDB/Redis on startup
            var hostedServices = services.Where(d => d.ServiceType == typeof(IHostedService)).ToList();
            foreach (var descriptor in hostedServices)
            {
                services.Remove(descriptor);
            }

            // Replace Redis cache service
            services.RemoveAll<IRedisCacheService>();
            services.AddSingleton<IRedisCacheService>(Cache);

            // Replace Email sender
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(EmailSender);

            // Register in-memory repositories
            RegisterRepository<AuthIdentity>(services);
            RegisterRepository<UserProfile>(services);
            RegisterRepository<ResourceAvailabilitySchedule>(services);
            RegisterRepository<Reservation>(services);
            RegisterRepository<EmployeeProfile>(services);
            RegisterRepository<EmployeeWeeklySchedule>(services);
            RegisterRepository<BusinessEntity>(services);
            RegisterRepository<WebsiteEntity>(services);
            RegisterRepository<WebsiteInvitation>(services);
            RegisterRepository<WebsitePage>(services);
            RegisterRepository<CustomerProfile>(services);

            // Mock MongoDB client and database
            var mockClient = new Mock<IMongoClient>();
            var mockDb = new Mock<IMongoDatabase>();
            var mockCollection = new Mock<IMongoCollection<BsonDocument>>();
            mockClient.Setup(c => c.GetDatabase(It.IsAny<string>(), It.IsAny<MongoDatabaseSettings>()))
                .Returns(mockDb.Object);
            mockDb.Setup(d => d.GetCollection<BsonDocument>(It.IsAny<string>(), It.IsAny<MongoCollectionSettings>()))
                .Returns(mockCollection.Object);

            services.RemoveAll<IMongoClient>();
            services.AddSingleton(mockClient.Object);

            // Mock Redis ConnectionMultiplexer
            var mockRedis = new Mock<IConnectionMultiplexer>();
            var mockRedisDb = new Mock<IDatabase>();
            mockRedis.Setup(r => r.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
                .Returns(mockRedisDb.Object);

            services.RemoveAll<IConnectionMultiplexer>();
            services.AddSingleton(mockRedis.Object);
        });
    }

    private void RegisterRepository<T>(IServiceCollection services) where T : BaseEntity
    {
        var repo = GetRepository<T>();
        services.RemoveAll<IMongoRepository<T>>();
        services.AddSingleton<IMongoRepository<T>>(repo);
    }

    public string GenerateJwtToken(
        Guid userId,
        Guid businessId,
        string role = "BusinessAdmin",
        string email = "admin@example.com")
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("business_id", businessId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };

        var token = new JwtSecurityToken(
            issuer: DefaultIssuer,
            audience: DefaultAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(DefaultJwtSecret)),
                SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public HttpClient CreateAuthenticatedClient(
        Guid businessId,
        Guid? websiteId = null,
        string role = "BusinessAdmin",
        string email = "admin@example.com",
        Guid? userId = null)
    {
        var client = CreateClient();
        var id = userId ?? Guid.NewGuid();
        var token = GenerateJwtToken(id, businessId, role, email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Add("X-Business-Id", businessId.ToString());
        if (websiteId.HasValue)
        {
            client.DefaultRequestHeaders.Add("X-Website-Id", websiteId.Value.ToString());
        }
        return client;
    }
}
