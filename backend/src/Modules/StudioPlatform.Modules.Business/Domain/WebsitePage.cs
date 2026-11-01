using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Business.Domain;

public sealed class WebsitePage : BaseEntity
{
    public Guid WebsiteId { get; set; }
    public string Slug { get; set; } = "home";
    public string Title { get; set; } = "Home";
    public bool ShowInNavigation { get; set; } = true;
    public string Status { get; set; } = "Draft";
    public string? SeoDescription { get; set; }
    public List<PageSection> Sections { get; set; } = [];
}

public sealed class PageSection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Type { get; set; } = "text";
    public string Heading { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public Dictionary<string, string> Settings { get; set; } = [];
}
