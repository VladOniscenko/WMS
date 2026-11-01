using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Business.Domain;

public sealed class WebsiteEntity : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string DomainOrSlug { get; set; } = string.Empty;

    public List<string> EnabledModules { get; set; } = [];

    public ThemeConfig ThemeConfig { get; set; } = new();

    public WebsiteContent Content { get; set; } = new();

    public List<string> ServiceIds { get; set; } = [];

    public string Category { get; set; } = "Other";

    public string TemplateId { get; set; } = "editorial";

    public string Status { get; set; } = "Draft";

    public DateTime? PublishedAtUtc { get; set; }
}
