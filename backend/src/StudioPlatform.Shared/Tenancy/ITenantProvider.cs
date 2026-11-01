namespace StudioPlatform.Shared.Tenancy;

public interface ITenantProvider
{
    Guid? BusinessId { get; }

    Guid? WebsiteId { get; }
}
