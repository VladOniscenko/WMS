using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Business.Domain;

public sealed class WebsiteInvitation : BaseEntity
{
    public Guid WebsiteId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Editor";
    public string Status { get; set; } = "Pending";
    public DateTime? AcceptedAtUtc { get; set; }
}
