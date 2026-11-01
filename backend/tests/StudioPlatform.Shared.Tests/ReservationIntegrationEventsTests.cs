using Microsoft.Extensions.DependencyInjection;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Messaging;
using Xunit;

namespace StudioPlatform.Shared.Tests;

public sealed class ReservationIntegrationEventsTests
{
    [Fact]
    public async Task ReservationCreatedIntegrationEvent_CanBePublishedAndHandled()
    {
        var services = new ServiceCollection();
        var handler = new TestReservationCreatedHandler();
        services.AddSingleton(handler);
        services.AddSingleton<IIntegrationEventHandler<ReservationCreatedIntegrationEvent>>(handler);

        await using var provider = services.BuildServiceProvider();
        var bus = new InMemoryEventBus(provider.GetRequiredService<IServiceScopeFactory>());

        var @event = new ReservationCreatedIntegrationEvent(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "John Doe",
            "john@example.com",
            "+123456789",
            "BIAB Manicure",
            DateTime.UtcNow.AddDays(1),
            DateTime.UtcNow.AddDays(1).AddHours(1),
            55m,
            "Window seat preferred");

        await bus.PublishAsync(@event);

        Assert.NotNull(handler.HandledEvent);
        Assert.Equal(@event.ReservationId, handler.HandledEvent.ReservationId);
        Assert.Equal("john@example.com", handler.HandledEvent.ClientEmail);
    }

    private sealed class TestReservationCreatedHandler : IIntegrationEventHandler<ReservationCreatedIntegrationEvent>
    {
        public ReservationCreatedIntegrationEvent? HandledEvent { get; private set; }

        public Task HandleAsync(ReservationCreatedIntegrationEvent @event, CancellationToken cancellationToken)
        {
            HandledEvent = @event;
            return Task.CompletedTask;
        }
    }
}
