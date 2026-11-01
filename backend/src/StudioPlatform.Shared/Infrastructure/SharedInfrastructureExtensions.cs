using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using StackExchange.Redis;
using StudioPlatform.Shared.Caching;
using StudioPlatform.Shared.Email;
using StudioPlatform.Shared.Messaging;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Storage;
using StudioPlatform.Shared.Tenancy;

namespace StudioPlatform.Shared.Infrastructure;

public static class SharedInfrastructureExtensions
{
    public static IServiceCollection AddSharedInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var mongoConnectionString =
            configuration["MongoDB:ConnectionString"] ?? "mongodb://localhost:27017";
        var redisConnectionString =
            configuration["Redis:ConnectionString"] ?? "localhost:6379";

        services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoConnectionString));
        services.AddSingleton<IConnectionMultiplexer>(_ =>
            ConnectionMultiplexer.Connect(new ConfigurationOptions
            {
                EndPoints = { redisConnectionString },
                AbortOnConnectFail = false
            }));
        services.AddSingleton<IRedisCacheService, RedisCacheService>();
        services.AddSingleton<IEventBus, InMemoryEventBus>();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantProvider>(provider => provider.GetRequiredService<TenantContext>());

        services.AddHostedService<MongoIndexInitializer>();
        services.AddHttpClient();

        var s3Section = configuration.GetSection("Storage:S3");
        if (!string.IsNullOrWhiteSpace(s3Section["BucketName"]))
        {
            services.Configure<S3StorageOptions>(s3Section);
            services.AddScoped<IAssetStorage, S3AssetStorage>();
        }
        else
        {
            services.AddScoped<IAssetStorage, LocalAssetStorage>();
        }

        services.AddSingleton<ConsoleDevelopmentEmailSender>();
        services.AddSingleton<IEmailSender>(provider =>
            string.Equals(configuration["Email:Provider"], "smtp", StringComparison.OrdinalIgnoreCase)
                ? new SmtpEmailSender(configuration)
                : provider.GetRequiredService<ConsoleDevelopmentEmailSender>());

        return services;
    }

    public static IServiceCollection AddMongoRepository<T>(
        this IServiceCollection services,
        string databaseName)
        where T : BaseEntity
    {
        services.AddScoped<IMongoRepository<T>>(provider =>
            new MongoRepository<T>(
                provider.GetRequiredService<IMongoClient>(),
                databaseName));

        return services;
    }
}
