using StudioPlatform.Shared.Messaging;

namespace StudioPlatform.Shared.Contracts;

public sealed record ReservationCreatedIntegrationEvent(
    Guid ReservationId,
    Guid BusinessId,
    Guid WebsiteId,
    Guid ResourceId,
    Guid ClientId,
    string ClientName,
    string ClientEmail,
    string? ClientPhone,
    string ServiceName,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    decimal Price,
    string? Notes) : IIntegrationEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();

    public DateTime OccurredOnUtc { get; init; } = DateTime.UtcNow;
}
