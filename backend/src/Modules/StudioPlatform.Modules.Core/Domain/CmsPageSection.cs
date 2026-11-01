using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Core.Domain;

public sealed class CmsPageSection : BaseEntity
{
    public Guid WebsiteId { get; set; }
    public string PageKey { get; set; } = string.Empty;
    public string SectionKey { get; set; } = string.Empty;
    public string ContentJson { get; set; } = "{}";
    public int Order { get; set; }
}
