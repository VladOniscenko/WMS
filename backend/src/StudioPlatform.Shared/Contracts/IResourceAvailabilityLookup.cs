namespace StudioPlatform.Shared.Contracts;

public interface IResourceAvailabilityLookup
{
    Task<bool> IsAvailableAsync(
        Guid businessId,
        Guid employeeId,
        DateTime startsAtUtc,
        DateTime endsAtUtc,
        CancellationToken cancellationToken = default);
}
