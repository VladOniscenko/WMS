using StudioPlatform.Modules.Business.Domain;

namespace StudioPlatform.Modules.Business.Contracts;

public sealed record CreateBusinessRequest(
    string Name,
    string OwnerEmail,
    string? SubscriptionTier = null);

public sealed record CreateWebsiteRequest(
    string Name,
    string DomainOrSlug,
    List<string>? EnabledModules = null,
    ThemeConfig? ThemeConfig = null);

public sealed record BusinessDetailsResponse(
    Guid Id,
    string Name,
    string OwnerEmail,
    string SubscriptionTier,
    bool IsActive,
    IReadOnlyList<WebsiteEntity> Websites);

public sealed record WebsiteResolutionResponse(
    Guid BusinessId,
    Guid WebsiteId,
    ThemeConfig ThemeConfig,
    IReadOnlyList<string> EnabledModules);
