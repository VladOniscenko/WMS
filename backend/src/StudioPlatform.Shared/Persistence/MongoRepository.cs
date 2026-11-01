using System.Linq.Expressions;
using MongoDB.Driver;

namespace StudioPlatform.Shared.Persistence;

public sealed class MongoRepository<T>(IMongoClient client, string databaseName) : IMongoRepository<T>
    where T : BaseEntity
{
    private readonly IMongoCollection<T> collection =
        client.GetDatabase(databaseName).GetCollection<T>(typeof(T).Name);

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await collection.Find(entity => entity.Id == id).FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<T>> GetByBusinessIdAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        return await collection.Find(entity => entity.BusinessId == businessId)
            .ToListAsync(cancellationToken);
    }

    public async Task<T?> FirstOrDefaultAsync(
        Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default) =>
        await collection.Find(predicate).FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default) =>
        await collection.Find(predicate).ToListAsync(cancellationToken);

    public Task InsertAsync(T entity, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        if (entity.Id == Guid.Empty)
        {
            entity.Id = Guid.NewGuid();
        }

        if (entity.CreatedAtUtc == default)
        {
            entity.CreatedAtUtc = now;
        }

        entity.UpdatedAtUtc = now;
        return collection.InsertOneAsync(entity, cancellationToken: cancellationToken);
    }

    public Task ReplaceAsync(T entity, CancellationToken cancellationToken = default)
    {
        entity.UpdatedAtUtc = DateTime.UtcNow;
        return collection.ReplaceOneAsync(
            item => item.Id == entity.Id,
            entity,
            new ReplaceOptions { IsUpsert = false },
            cancellationToken);
    }

    public Task DeleteAsync(Guid id, CancellationToken cancellationToken = default) =>
        collection.DeleteOneAsync(entity => entity.Id == id, cancellationToken);
}
