using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace StudioPlatform.Shared.Persistence;

public abstract class BaseEntity
{
    [BsonGuidRepresentation(GuidRepresentation.Standard)]
    public Guid Id { get; set; }

    [BsonGuidRepresentation(GuidRepresentation.Standard)]
    public Guid BusinessId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }
}
