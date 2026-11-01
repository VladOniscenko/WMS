namespace StudioPlatform.Shared.Messaging;

public interface IIntegrationEvent
{
    Guid EventId { get; }

    DateTime OccurredOnUtc { get; }

    Guid BusinessId { get; }
}
