using Microsoft.Extensions.DependencyInjection;

namespace StudioPlatform.Shared.Messaging;

public sealed class InMemoryEventBus(IServiceScopeFactory scopeFactory) : IEventBus
{
    public async Task PublishAsync<TEvent>(
        TEvent @event,
        CancellationToken cancellationToken = default)
        where TEvent : IIntegrationEvent
    {
        ArgumentNullException.ThrowIfNull(@event);

        using var scope = scopeFactory.CreateScope();
        var handlers = scope.ServiceProvider.GetServices<IIntegrationEventHandler<TEvent>>();

        await Task.WhenAll(
            handlers.Select(handler => handler.HandleAsync(@event, cancellationToken)));
    }
}
