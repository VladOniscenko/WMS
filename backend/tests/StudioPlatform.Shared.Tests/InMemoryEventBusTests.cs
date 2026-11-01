using Microsoft.Extensions.DependencyInjection;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Messaging;
using Xunit;

namespace StudioPlatform.Shared.Tests;

public sealed class InMemoryEventBusTests
{
    [Fact]
    public async Task PublishingEventExecutesAllRegisteredHandlers()
    {
        var services = new ServiceCollection();
        services.AddSingleton<AuditHandler>();
        services.AddSingleton<AvailabilityHandler>();
        services.AddSingleton<IIntegrationEventHandler<UserAuthenticatedIntegrationEvent>>(
            provider => provider.GetRequiredService<AuditHandler>());
        services.AddSingleton<IIntegrationEventHandler<UserAuthenticatedIntegrationEvent>>(
            provider => provider.GetRequiredService<AvailabilityHandler>());

        await using var provider = services.BuildServiceProvider();
        var bus = new InMemoryEventBus(provider.GetRequiredService<IServiceScopeFactory>());
        var @event = new UserAuthenticatedIntegrationEvent(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "owner@example.com",
            "Owner");

        await bus.PublishAsync(@event);

        Assert.Equal(@event.EventId, provider.GetRequiredService<AuditHandler>().HandledEventId);
        Assert.Equal(@event.EventId, provider.GetRequiredService<AvailabilityHandler>().HandledEventId);
    }

    private sealed class AuditHandler : IIntegrationEventHandler<UserAuthenticatedIntegrationEvent>
    {
        public Guid? HandledEventId { get; private set; }

        public Task HandleAsync(
            UserAuthenticatedIntegrationEvent @event,
            CancellationToken cancellationToken)
        {
            HandledEventId = @event.EventId;
            return Task.CompletedTask;
        }
    }

    private sealed class AvailabilityHandler : IIntegrationEventHandler<UserAuthenticatedIntegrationEvent>
    {
        public Guid? HandledEventId { get; private set; }

        public Task HandleAsync(
            UserAuthenticatedIntegrationEvent @event,
            CancellationToken cancellationToken)
        {
            HandledEventId = @event.EventId;
            return Task.CompletedTask;
        }
    }
}
