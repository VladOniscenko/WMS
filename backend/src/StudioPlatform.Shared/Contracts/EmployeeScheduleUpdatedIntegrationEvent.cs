using StudioPlatform.Shared.Messaging;

namespace StudioPlatform.Shared.Contracts;

public sealed record EmployeeScheduleUpdatedIntegrationEvent(
    Guid BusinessId,
    Guid? WebsiteId,
    Guid EmployeeId,
    List<WorkingWindowDto> Windows) : IIntegrationEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();

    public DateTime OccurredOnUtc { get; init; } = DateTime.UtcNow;
}
