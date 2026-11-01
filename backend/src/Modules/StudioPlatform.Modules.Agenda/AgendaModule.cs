using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using StudioPlatform.Shared.Caching;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Messaging;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Tenancy;

namespace StudioPlatform.Modules.Agenda;

public enum ReservationStatus { Pending, Confirmed, Cancelled, Completed }

public sealed class ClientSnapshot { public string? Name { get; set; } public string? Email { get; set; } public string? Phone { get; set; } }
public sealed class ServiceSnapshot { public Guid ServiceId { get; set; } public string? ServiceName { get; set; } public int DurationMinutes { get; set; } public decimal Price { get; set; } }
public sealed class DateOverride { public DateOnly Date { get; set; } public List<AgendaWindow>? Windows { get; set; } public bool IsUnavailable { get; set; } }
public sealed class AgendaWindow { public DayOfWeek Day { get; set; } public TimeOnly StartTime { get; set; } public TimeOnly EndTime { get; set; } public TimeOnly? BreakStart { get; set; } public TimeOnly? BreakEnd { get; set; } }

public sealed class ResourceAvailabilitySchedule : BaseEntity
{
    public Guid WebsiteId { get; set; }
    public Guid ResourceId { get; set; }
    public List<AgendaWindow> WeeklyWindows { get; set; } = [];
    public List<DateOverride> DateOverrides { get; set; } = [];
}

public sealed class Reservation : BaseEntity
{
    public Guid WebsiteId { get; set; }
    public Guid ResourceId { get; set; }
    public Guid ClientId { get; set; }
    public ClientSnapshot ClientSnapshot { get; set; } = new();
    public ServiceSnapshot ServiceSnapshot { get; set; } = new();
    public DateTime StartAtUtc { get; set; }
    public DateTime EndAtUtc { get; set; }
    public string Status { get; set; } = nameof(ReservationStatus.Pending);
    public string? Notes { get; set; }
}

public sealed record AvailableSlot(DateTime StartTimeUtc, DateTime EndTimeUtc, Guid ResourceId);

public interface IAvailabilityCalculator
{
    Task<IReadOnlyList<AvailableSlot>> GetSlotsAsync(
        Guid businessId, Guid websiteId, Guid? resourceId, DateOnly date,
        int durationMinutes, int slotIntervalMinutes, CancellationToken cancellationToken);
}

public sealed class AvailabilityCalculator(
    IMongoRepository<ResourceAvailabilitySchedule> schedules,
    IMongoRepository<Reservation> reservations) : IAvailabilityCalculator
{
    public async Task<IReadOnlyList<AvailableSlot>> GetSlotsAsync(
        Guid businessId, Guid websiteId, Guid? resourceId, DateOnly date,
        int durationMinutes, int slotIntervalMinutes, CancellationToken cancellationToken)
    {
        var candidates = resourceId is Guid resource
            ? [resource]
            : (await schedules.FindAsync(x => x.BusinessId == businessId && x.WebsiteId == websiteId, cancellationToken))
                .Select(x => x.ResourceId).Distinct().ToList();
        var result = new List<AvailableSlot>();
        foreach (var id in candidates)
        {
            var schedule = await schedules.FirstOrDefaultAsync(
                x => x.BusinessId == businessId && x.WebsiteId == websiteId && x.ResourceId == id,
                cancellationToken);
            if (schedule is null) continue;
            var overrideWindow = schedule.DateOverrides.FirstOrDefault(x => x.Date == date);
            if (overrideWindow?.IsUnavailable == true) continue;
            var windows = overrideWindow?.Windows ?? schedule.WeeklyWindows
                .Where(x => x.Day == date.DayOfWeek).ToList();
            var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var existing = await reservations.FindAsync(
                x => x.BusinessId == businessId && x.WebsiteId == websiteId &&
                    x.ResourceId == id && x.Status != nameof(ReservationStatus.Cancelled) &&
                    x.StartAtUtc < dayStart.AddDays(1) && x.EndAtUtc > dayStart,
                cancellationToken);
            foreach (var window in windows)
            {
                for (var start = window.StartTime; start.AddMinutes(durationMinutes) <= window.EndTime; start = start.AddMinutes(slotIntervalMinutes))
                {
                    var slotStart = date.ToDateTime(start, DateTimeKind.Utc);
                    var slotEnd = slotStart.AddMinutes(durationMinutes);
                    var inBreak = window.BreakStart is TimeOnly breakStart && window.BreakEnd is TimeOnly breakEnd &&
                        start < breakEnd && start.AddMinutes(durationMinutes) > breakStart;
                    var booked = existing.Any(x => x.StartAtUtc < slotEnd && slotStart < x.EndAtUtc);
                    if (!inBreak && !booked) result.Add(new AvailableSlot(slotStart, slotEnd, id));
                }
            }
        }
        return result.OrderBy(x => x.StartTimeUtc).ToArray();
    }
}

public sealed class EmployeeScheduleSyncHandler(
    IMongoRepository<ResourceAvailabilitySchedule> schedules)
    : IIntegrationEventHandler<EmployeeScheduleUpdatedIntegrationEvent>
{
    public async Task HandleAsync(EmployeeScheduleUpdatedIntegrationEvent @event, CancellationToken cancellationToken)
    {
        var existing = await schedules.FirstOrDefaultAsync(
            x => x.BusinessId == @event.BusinessId && x.WebsiteId == @event.WebsiteId &&
                x.ResourceId == @event.EmployeeId, cancellationToken);
        var schedule = existing ?? new ResourceAvailabilitySchedule
        {
            Id = Guid.NewGuid(), BusinessId = @event.BusinessId,
            WebsiteId = @event.WebsiteId ?? Guid.Empty, ResourceId = @event.EmployeeId
        };
        schedule.WeeklyWindows = @event.Windows.Select(x => new AgendaWindow
        {
            Day = x.Day, StartTime = x.StartTime, EndTime = x.EndTime
        }).ToList();
        if (existing is null) await schedules.InsertAsync(schedule, cancellationToken);
        else await schedules.ReplaceAsync(schedule, cancellationToken);
    }
}

public sealed class ReservationService(
    IRedisCacheService cache,
    IMongoRepository<Reservation> reservations)
{
    public async Task<Reservation?> CreateAsync(
        Reservation reservation, CancellationToken cancellationToken)
    {
        var key = $"agenda:lock:{reservation.ResourceId}:{reservation.StartAtUtc:yyyyMMdd}";
        if (!await cache.AcquireLockAsync(key, TimeSpan.FromSeconds(5))) return null;
        try
        {
            var overlap = await reservations.FirstOrDefaultAsync(
                x => x.BusinessId == reservation.BusinessId && x.WebsiteId == reservation.WebsiteId &&
                    x.ResourceId == reservation.ResourceId && x.Status != nameof(ReservationStatus.Cancelled) &&
                    x.StartAtUtc < reservation.EndAtUtc && reservation.StartAtUtc < x.EndAtUtc,
                cancellationToken);
            if (overlap is not null) return null;
            reservation.Id = Guid.NewGuid();
            await reservations.InsertAsync(reservation, cancellationToken);
            return reservation;
        }
        finally { await cache.ReleaseLockAsync(key); }
    }
}

public sealed class AgendaModule : IModule
{
    public void RegisterModule(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMongoRepository<ResourceAvailabilitySchedule>("studio_agenda");
        services.AddMongoRepository<Reservation>("studio_agenda");
        services.AddSingleton<IHostedService, AgendaIndexInitializer>();
        services.AddScoped<IAvailabilityCalculator, AvailabilityCalculator>();
        services.AddScoped<ReservationService>();
        services.AddScoped<IIntegrationEventHandler<EmployeeScheduleUpdatedIntegrationEvent>, EmployeeScheduleSyncHandler>();
    }

    public sealed class AgendaIndexInitializer(IMongoClient client) : IHostedService
    {
        public async Task StartAsync(CancellationToken cancellationToken) =>
            await client.GetDatabase("studio_agenda")
                .GetCollection<Reservation>(nameof(Reservation)).Indexes.CreateOneAsync(
                    new CreateIndexModel<Reservation>(
                        Builders<Reservation>.IndexKeys
                            .Ascending(x => x.BusinessId).Ascending(x => x.ResourceId)
                            .Ascending(x => x.StartAtUtc).Ascending(x => x.EndAtUtc)),
                    cancellationToken: cancellationToken);

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/agenda/slots", SlotsAsync);
        endpoints.MapPost("/api/agenda/reservations", CreateReservationAsync).RequireAuthorization();
        endpoints.MapGet("/api/agenda/reservations/my", MyReservationsAsync).RequireAuthorization();
        endpoints.MapGet("/api/agenda/reservations", ReservationsAsync).RequireAuthorization();
        endpoints.MapPatch("/api/agenda/reservations/{id:guid}", UpdateReservationAsync).RequireAuthorization();
        endpoints.MapPatch("/api/agenda/reservations/{id:guid}/cancel", CancelAsync).RequireAuthorization();
        endpoints.MapPut("/api/agenda/resources/{resourceId:guid}/schedule", SetScheduleAsync).RequireAuthorization();
    }

    private static async Task<IResult> SlotsAsync(
        Guid? resourceId, DateOnly date, int durationMinutes, int? slotIntervalMinutes,
        ITenantProvider tenant, IAvailabilityCalculator calculator, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId || tenant.WebsiteId is not Guid websiteId ||
            durationMinutes <= 0) return Results.BadRequest();
        return Results.Ok(await calculator.GetSlotsAsync(
            businessId, websiteId, resourceId, date, durationMinutes, slotIntervalMinutes ?? 15, ct));
    }

    private static async Task<IResult> CreateReservationAsync(
        Reservation reservation, ITenantProvider tenant, ReservationService service, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId || tenant.WebsiteId is not Guid websiteId)
            return Results.BadRequest();
        reservation.BusinessId = businessId; reservation.WebsiteId = websiteId;
        return await service.CreateAsync(reservation, ct) is { } created
            ? Results.Created($"/api/agenda/reservations/{created.Id}", created)
            : Results.Conflict("The resource is already booked.");
    }

    private static async Task<IResult> MyReservationsAsync(
        ClaimsPrincipal user, ITenantProvider tenant, IMongoRepository<Reservation> repository, CancellationToken ct)
    {
        return Guid.TryParse(user.FindFirst("sub")?.Value, out var clientId) && tenant.BusinessId is Guid businessId
            ? Results.Ok(await repository.FindAsync(x => x.BusinessId == businessId && x.ClientId == clientId, ct))
            : Results.Unauthorized();
    }

    private static async Task<IResult> ReservationsAsync(
        DateTime? from, DateTime? to, Guid? resourceId, ITenantProvider tenant,
        IMongoRepository<Reservation> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId) return Results.BadRequest();
        return Results.Ok(await repository.FindAsync(x => x.BusinessId == businessId &&
            (!from.HasValue || x.StartAtUtc >= from) && (!to.HasValue || x.StartAtUtc <= to) &&
            (!resourceId.HasValue || x.ResourceId == resourceId), ct));
    }

    private static async Task<IResult> CancelAsync(
        Guid id, ITenantProvider tenant, IMongoRepository<Reservation> repository, CancellationToken ct)
    {
        var reservation = await repository.GetByIdAsync(id, ct);
        if (reservation is null || reservation.BusinessId != tenant.BusinessId) return Results.NotFound();
        reservation.Status = nameof(ReservationStatus.Cancelled);
        await repository.ReplaceAsync(reservation, ct);
        return Results.Ok(reservation);
    }

    private static async Task<IResult> UpdateReservationAsync(
        Guid id, Reservation input, ITenantProvider tenant,
        IMongoRepository<Reservation> repository, CancellationToken ct)
    {
        var reservation = await repository.GetByIdAsync(id, ct);
        if (reservation is null || tenant.BusinessId is not Guid businessId || reservation.BusinessId != businessId)
            return Results.NotFound();
        if (input.Status is not (nameof(ReservationStatus.Pending) or nameof(ReservationStatus.Confirmed) or nameof(ReservationStatus.Completed)))
            return Results.BadRequest("Unsupported reservation status.");
        reservation.Status = input.Status;
        reservation.Notes = input.Notes;
        await repository.ReplaceAsync(reservation, ct);
        return Results.Ok(reservation);
    }

    private static async Task<IResult> SetScheduleAsync(
        Guid resourceId, ResourceAvailabilitySchedule schedule, ITenantProvider tenant,
        IMongoRepository<ResourceAvailabilitySchedule> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId || tenant.WebsiteId is not Guid websiteId)
            return Results.BadRequest();
        var existing = await repository.FirstOrDefaultAsync(
            x => x.BusinessId == businessId && x.WebsiteId == websiteId && x.ResourceId == resourceId, ct);
        schedule.Id = existing?.Id ?? Guid.NewGuid(); schedule.BusinessId = businessId;
        schedule.WebsiteId = websiteId; schedule.ResourceId = resourceId;
        if (existing is null) await repository.InsertAsync(schedule, ct);
        else await repository.ReplaceAsync(schedule, ct);
        return Results.Ok(schedule);
    }
}
