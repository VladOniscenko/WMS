namespace StudioPlatform.Modules.Business.Domain;

public sealed class WebsiteContent
{
    public string Title { get; set; } = string.Empty;
    public string? Tagline { get; set; }
    public string? HeroText { get; set; }
    public string? HeroImageUrl { get; set; }
    public string? AboutText { get; set; }
    public List<string> GalleryImageUrls { get; set; } = [];
    public WebsiteNavigation Navigation { get; set; } = new();
    public WebsiteFooter Footer { get; set; } = new();
}

public sealed class WebsiteNavigation
{
    public string BrandLabel { get; set; } = string.Empty;
    public List<WebsiteNavigationItem> Items { get; set; } = [];
    public bool ShowBookingButton { get; set; } = true;
}

public sealed class WebsiteNavigationItem
{
    public string Label { get; set; } = string.Empty;
    public string PageSlug { get; set; } = string.Empty;
}

public sealed class WebsiteFooter
{
    public string Text { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
}
