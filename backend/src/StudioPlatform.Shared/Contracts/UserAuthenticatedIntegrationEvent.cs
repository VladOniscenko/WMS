using StudioPlatform.Shared.Messaging;

namespace StudioPlatform.Shared.Contracts;

public sealed record UserAuthenticatedIntegrationEvent(
    Guid UserId,
    Guid BusinessId,
    string Email,
    string Role) : IIntegrationEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();

    public DateTime OccurredOnUtc { get; init; } = DateTime.UtcNow;
}
