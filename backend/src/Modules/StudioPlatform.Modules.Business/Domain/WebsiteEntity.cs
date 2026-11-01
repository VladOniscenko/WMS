using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Business.Domain;

public sealed class WebsiteEntity : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string DomainOrSlug { get; set; } = string.Empty;

    public List<string> EnabledModules { get; set; } = [];

    public ThemeConfig ThemeConfig { get; set; } = new();
}
