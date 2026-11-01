using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace StudioPlatform.Shared.Persistence;

public sealed class MongoIndexInitializer(
    IMongoClient client,
    ILogger<MongoIndexInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Initializing MongoDB indexes...");

        // studio_agenda: Reservation
        var reservationCollection = client.GetDatabase("studio_agenda").GetCollection<BsonDocument>("Reservation");
        await TryCreateIndexAsync(
            reservationCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("BusinessId")
                    .Ascending("WebsiteId")
                    .Ascending("ResourceId")
                    .Ascending("StartAtUtc"),
                new CreateIndexOptions { Name = "idx_reservation_business_website_resource_start" }),
            cancellationToken);

        await TryCreateIndexAsync(
            reservationCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("BusinessId")
                    .Ascending("ClientId"),
                new CreateIndexOptions { Name = "idx_reservation_business_client" }),
            cancellationToken);

        // WMS-034: Unique partial index to prevent double-booking on (ResourceId, StartAtUtc) when Status != Cancelled
        await TryCreateIndexAsync(
            reservationCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("ResourceId")
                    .Ascending("StartAtUtc"),
                new CreateIndexOptions<BsonDocument>
                {
                    Name = "idx_reservation_resource_start_active",
                    Unique = true,
                    PartialFilterExpression = Builders<BsonDocument>.Filter.Ne("Status", "Cancelled")
                }),
            cancellationToken);

        // studio_agenda: ResourceAvailabilitySchedule
        var scheduleCollection = client.GetDatabase("studio_agenda").GetCollection<BsonDocument>("ResourceAvailabilitySchedule");
        await TryCreateIndexAsync(
            scheduleCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("BusinessId")
                    .Ascending("WebsiteId")
                    .Ascending("ResourceId"),
                new CreateIndexOptions
                {
                    Name = "idx_schedule_business_website_resource_unique",
                    Unique = true
                }),
            cancellationToken);

        // studio_employees: EmployeeProfile
        var employeeCollection = client.GetDatabase("studio_employees").GetCollection<BsonDocument>("EmployeeProfile");
        await TryCreateIndexAsync(
            employeeCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("BusinessId")
                    .Ascending("Email"),
                new CreateIndexOptions
                {
                    Name = "idx_employee_business_email_unique",
                    Unique = true
                }),
            cancellationToken);

        // studio_business: WebsitePage
        var websitePageCollection = client.GetDatabase("studio_business").GetCollection<BsonDocument>("WebsitePage");
        await TryCreateIndexAsync(
            websitePageCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("WebsiteId")
                    .Ascending("Slug"),
                new CreateIndexOptions
                {
                    Name = "idx_websitepage_website_slug_unique",
                    Unique = true
                }),
            cancellationToken);

        // studio_business: WebsiteEntity
        var websiteEntityCollection = client.GetDatabase("studio_business").GetCollection<BsonDocument>("WebsiteEntity");
        await TryCreateIndexAsync(
            websiteEntityCollection,
            new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys
                    .Ascending("DomainOrSlug"),
                new CreateIndexOptions
                {
                    Name = "idx_website_domain_or_slug_unique",
                    Unique = true
                }),
            cancellationToken);

        logger.LogInformation("MongoDB indexes initialization completed.");
    }

    private async Task TryCreateIndexAsync(
        IMongoCollection<BsonDocument> collection,
        CreateIndexModel<BsonDocument> model,
        CancellationToken cancellationToken)
    {
        try
        {
            await collection.Indexes.CreateOneAsync(model, cancellationToken: cancellationToken);
        }
        catch (MongoCommandException ex)
        {
            logger.LogWarning(
                ex,
                "Notice during index creation on collection {Collection} with name {IndexName}: {Message}",
                collection.CollectionNamespace.CollectionName,
                model.Options?.Name,
                ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Unexpected error creating index on {Collection}: {Message}",
                collection.CollectionNamespace.CollectionName,
                ex.Message);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
