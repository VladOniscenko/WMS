using System.Text.Json;
using StackExchange.Redis;

namespace StudioPlatform.Shared.Caching;

public sealed class RedisCacheService(IConnectionMultiplexer connection) : IRedisCacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IDatabase database = connection.GetDatabase();

    public Task SetAsync<T>(string key, T value, TimeSpan ttl) =>
        database.StringSetAsync(key, JsonSerializer.Serialize(value, JsonOptions), ttl);

    public async Task<T?> GetAsync<T>(string key)
    {
        var value = await database.StringGetAsync(key);
        return value.IsNull ? default : JsonSerializer.Deserialize<T>(value.ToString(), JsonOptions);
    }

    public Task RemoveAsync(string key) => database.KeyDeleteAsync(key);

    public Task<bool> AcquireLockAsync(string key, TimeSpan ttl) =>
        database.StringSetAsync($"lock:{key}", Environment.MachineName, ttl, When.NotExists);

    public Task ReleaseLockAsync(string key) => database.KeyDeleteAsync($"lock:{key}");
}
