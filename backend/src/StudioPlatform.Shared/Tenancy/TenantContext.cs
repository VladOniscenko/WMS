namespace StudioPlatform.Shared.Tenancy;

public sealed class TenantContext : ITenantProvider
{
    public Guid? BusinessId { get; internal set; }

    public Guid? WebsiteId { get; internal set; }
}
