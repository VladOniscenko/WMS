using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Core.Domain;

public sealed class CatalogServiceItem : BaseEntity
{
    public Guid WebsiteId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? Category { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
}
