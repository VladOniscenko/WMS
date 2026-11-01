using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Business.Domain;

public sealed class BusinessEntity : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string OwnerEmail { get; set; } = string.Empty;

    public string SubscriptionTier { get; set; } = "Free";

    public bool IsActive { get; set; } = true;
}
