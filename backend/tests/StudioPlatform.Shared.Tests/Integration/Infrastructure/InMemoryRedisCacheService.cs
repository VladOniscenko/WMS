using System.Collections.Concurrent;
using System.Text.Json;
using StudioPlatform.Shared.Caching;

namespace StudioPlatform.Shared.Tests.Integration.Infrastructure;

public sealed class InMemoryRedisCacheService : IRedisCacheService
{
    private readonly ConcurrentDictionary<string, string> _store = new();
    private readonly ConcurrentDictionary<string, DateTime> _locks = new();
    private readonly object _lockObj = new();

    public Task SetAsync<T>(string key, T value, TimeSpan ttl)
    {
        _store[key] = JsonSerializer.Serialize(value);
        return Task.CompletedTask;
    }

    public Task<T?> GetAsync<T>(string key)
    {
        if (_store.TryGetValue(key, out var json))
        {
            try
            {
                var result = JsonSerializer.Deserialize<T>(json);
                return Task.FromResult(result);
            }
            catch
            {
                return Task.FromResult(default(T));
            }
        }
        return Task.FromResult(default(T));
    }

    public Task RemoveAsync(string key)
    {
        _store.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    public Task<bool> AcquireLockAsync(string key, TimeSpan ttl)
    {
        lock (_lockObj)
        {
            var now = DateTime.UtcNow;
            if (_locks.TryGetValue(key, out var expiry) && expiry > now)
            {
                return Task.FromResult(false);
            }
            _locks[key] = now.Add(ttl);
            return Task.FromResult(true);
        }
    }

    public Task ReleaseLockAsync(string key)
    {
        _locks.TryRemove(key, out _);
        return Task.CompletedTask;
    }
}

