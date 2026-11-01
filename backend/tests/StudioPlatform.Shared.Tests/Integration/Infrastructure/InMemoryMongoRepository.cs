using System.Collections.Concurrent;
using System.Linq.Expressions;
using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Shared.Tests.Integration.Infrastructure;

public sealed class InMemoryMongoRepository<T> : IMongoRepository<T> where T : BaseEntity
{
    private readonly ConcurrentDictionary<Guid, T> _store = new();

    public Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _store.TryGetValue(id, out var entity);
        return Task.FromResult(entity);
    }

    public Task<IReadOnlyList<T>> GetByBusinessIdAsync(Guid businessId, CancellationToken cancellationToken = default)
    {
        var result = _store.Values.Where(x => x.BusinessId == businessId).ToList();
        return Task.FromResult<IReadOnlyList<T>>(result);
    }

    public Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        var func = predicate.Compile();
        var entity = _store.Values.FirstOrDefault(func);
        return Task.FromResult(entity);
    }

    public Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default)
    {
        var func = predicate.Compile();
        var result = _store.Values.Where(func).ToList();
        return Task.FromResult<IReadOnlyList<T>>(result);
    }

    public Task InsertAsync(T entity, CancellationToken cancellationToken = default)
    {
        if (entity.Id == Guid.Empty)
        {
            entity.Id = Guid.NewGuid();
        }
        entity.CreatedAtUtc = DateTime.UtcNow;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        _store[entity.Id] = entity;
        return Task.CompletedTask;
    }

    public Task ReplaceAsync(T entity, CancellationToken cancellationToken = default)
    {
        entity.UpdatedAtUtc = DateTime.UtcNow;
        _store[entity.Id] = entity;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _store.TryRemove(id, out _);
        return Task.CompletedTask;
    }

    public void Seed(T entity)
    {
        if (entity.Id == Guid.Empty) entity.Id = Guid.NewGuid();
        _store[entity.Id] = entity;
    }
}

