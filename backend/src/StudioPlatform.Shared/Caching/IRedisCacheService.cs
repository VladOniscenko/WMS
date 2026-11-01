namespace StudioPlatform.Shared.Caching;

public interface IRedisCacheService
{
    Task SetAsync<T>(string key, T value, TimeSpan ttl);

    Task<T?> GetAsync<T>(string key);

    Task RemoveAsync(string key);

    Task<bool> AcquireLockAsync(string key, TimeSpan ttl);

    Task ReleaseLockAsync(string key);
}
