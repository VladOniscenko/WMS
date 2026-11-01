using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using StudioPlatform.Shared.Caching;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Email;
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
    IMongoRepository<ResourceAvailabilitySchedule> schedules,
    ILogger<EmployeeScheduleSyncHandler> logger)
    : IIntegrationEventHandler<EmployeeScheduleUpdatedIntegrationEvent>
{
    public async Task HandleAsync(EmployeeScheduleUpdatedIntegrationEvent @event, CancellationToken cancellationToken)
    {
        try
        {
            var windows = @event.Windows.Select(x => new AgendaWindow
            {
                Day = x.Day,
                StartTime = x.StartTime,
                EndTime = x.EndTime,
                BreakStart = x.BreakStart,
                BreakEnd = x.BreakEnd
            }).ToList();

            if (@event.WebsiteId.HasValue && @event.WebsiteId.Value != Guid.Empty)
            {
                var targetWebsiteId = @event.WebsiteId.Value;
                var existing = await schedules.FirstOrDefaultAsync(
                    x => x.BusinessId == @event.BusinessId && x.WebsiteId == targetWebsiteId &&
                        x.ResourceId == @event.EmployeeId, cancellationToken);
                var schedule = existing ?? new ResourceAvailabilitySchedule
                {
                    Id = Guid.NewGuid(),
                    BusinessId = @event.BusinessId,
                    WebsiteId = targetWebsiteId,
                    ResourceId = @event.EmployeeId
                };
                schedule.WeeklyWindows = windows;

                if (existing is null) await schedules.InsertAsync(schedule, cancellationToken);
                else await schedules.ReplaceAsync(schedule, cancellationToken);
            }
            else
            {
                var existingSchedules = await schedules.FindAsync(
                    x => x.BusinessId == @event.BusinessId && x.ResourceId == @event.EmployeeId, cancellationToken);

                if (existingSchedules.Count > 0)
                {
                    foreach (var schedule in existingSchedules)
                    {
                        schedule.WeeklyWindows = windows;
                        await schedules.ReplaceAsync(schedule, cancellationToken);
                    }
                }
                else
                {
                    var schedule = new ResourceAvailabilitySchedule
                    {
                        Id = Guid.NewGuid(),
                        BusinessId = @event.BusinessId,
                        WebsiteId = Guid.Empty,
                        ResourceId = @event.EmployeeId,
                        WeeklyWindows = windows
                    };
                    await schedules.InsertAsync(schedule, cancellationToken);
                }
            }

            logger.LogInformation(
                "Updated availability schedule for resource {ResourceId} in business {BusinessId}",
                @event.EmployeeId, @event.BusinessId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to sync employee schedule for resource {ResourceId}", @event.EmployeeId);
        }
    }
}

public sealed class ReservationEmailNotificationHandler(
    IEmailSender emailSender,
    IMongoClient mongoClient,
    ILogger<ReservationEmailNotificationHandler> logger)
    : IIntegrationEventHandler<ReservationCreatedIntegrationEvent>,
      IIntegrationEventHandler<ReservationCancelledIntegrationEvent>
{
    public async Task HandleAsync(ReservationCreatedIntegrationEvent @event, CancellationToken cancellationToken)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(@event.ClientEmail))
            {
                var customerSubject = $"Reservation Confirmed: {@event.ServiceName}";
                var customerHtml = $@"
<div style='font-family: sans-serif; line-height: 1.5;'>
    <h2 style='color: #2b2b2b;'>Your appointment is confirmed!</h2>
    <p>Dear {@event.ClientName},</p>
    <p>Thank you for booking with us. Here are your reservation details:</p>
    <ul>
        <li><strong>Service:</strong> {@event.ServiceName}</li>
        <li><strong>Date & Time (UTC):</strong> {@event.StartAtUtc:yyyy-MM-dd HH:mm} - {@event.EndAtUtc:HH:mm}</li>
        <li><strong>Price:</strong> {@event.Price:C}</li>
        {(!string.IsNullOrWhiteSpace(@event.Notes) ? $"<li><strong>Notes:</strong> {@event.Notes}</li>" : "")}
    </ul>
    <p>Reservation ID: <code>{@event.ReservationId}</code></p>
</div>";
                await emailSender.SendEmailAsync(@event.ClientEmail, customerSubject, customerHtml, cancellationToken);
            }

            var ownerEmail = await LookupBusinessOwnerEmailAsync(@event.BusinessId, cancellationToken);
            if (!string.IsNullOrWhiteSpace(ownerEmail))
            {
                var ownerSubject = $"New Booking: {@event.ServiceName} - {@event.ClientName}";
                var ownerHtml = $@"
<div style='font-family: sans-serif; line-height: 1.5;'>
    <h2 style='color: #2b2b2b;'>New appointment received</h2>
    <p>A new reservation has been booked:</p>
    <ul>
        <li><strong>Client:</strong> {@event.ClientName} ({@event.ClientEmail} / {@event.ClientPhone})</li>
        <li><strong>Service:</strong> {@event.ServiceName}</li>
        <li><strong>Date & Time (UTC):</strong> {@event.StartAtUtc:yyyy-MM-dd HH:mm} - {@event.EndAtUtc:HH:mm}</li>
        <li><strong>Price:</strong> {@event.Price:C}</li>
    </ul>
    <p>Reservation ID: <code>{@event.ReservationId}</code></p>
</div>";
                await emailSender.SendEmailAsync(ownerEmail, ownerSubject, ownerHtml, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send reservation confirmation email for reservation {ReservationId}", @event.ReservationId);
        }
    }

    public async Task HandleAsync(ReservationCancelledIntegrationEvent @event, CancellationToken cancellationToken)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(@event.ClientEmail))
            {
                var customerSubject = $"Reservation Cancelled: {@event.ServiceName}";
                var customerHtml = $@"
<div style='font-family: sans-serif; line-height: 1.5;'>
    <h2 style='color: #b91c1c;'>Your appointment has been cancelled</h2>
    <p>Dear {@event.ClientName},</p>
    <p>Your appointment for <strong>{@event.ServiceName}</strong> scheduled on <strong>{@event.StartAtUtc:yyyy-MM-dd HH:mm} UTC</strong> has been cancelled.</p>
    <p>Reservation ID: <code>{@event.ReservationId}</code></p>
</div>";
                await emailSender.SendEmailAsync(@event.ClientEmail, customerSubject, customerHtml, cancellationToken);
            }

            var ownerEmail = await LookupBusinessOwnerEmailAsync(@event.BusinessId, cancellationToken);
            if (!string.IsNullOrWhiteSpace(ownerEmail))
            {
                var ownerSubject = $"Cancellation: {@event.ServiceName} - {@event.ClientName}";
                var ownerHtml = $@"
<div style='font-family: sans-serif; line-height: 1.5;'>
    <h2 style='color: #b91c1c;'>Appointment Cancelled</h2>
    <p>Reservation <code>{@event.ReservationId}</code> for <strong>{@event.ClientName}</strong> on <strong>{@event.StartAtUtc:yyyy-MM-dd HH:mm} UTC</strong> has been cancelled.</p>
</div>";
                await emailSender.SendEmailAsync(ownerEmail, ownerSubject, ownerHtml, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send cancellation notification email for reservation {ReservationId}", @event.ReservationId);
        }
    }

    private async Task<string?> LookupBusinessOwnerEmailAsync(Guid businessId, CancellationToken cancellationToken)
    {
        try
        {
            var businessCollection = mongoClient.GetDatabase("studio_business").GetCollection<BsonDocument>("BusinessEntity");
            var filter = Builders<BsonDocument>.Filter.Eq("_id", businessId) | Builders<BsonDocument>.Filter.Eq("Id", businessId);
            var doc = await businessCollection.Find(filter).FirstOrDefaultAsync(cancellationToken);
            if (doc is not null && doc.Contains("OwnerEmail"))
            {
                return doc["OwnerEmail"].AsString;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not resolve owner email for BusinessId {BusinessId}", businessId);
        }
        return null;
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
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return null;
        }
        catch (MongoBulkWriteException ex) when (ex.WriteErrors.Any(e => e.Category == ServerErrorCategory.DuplicateKey))
        {
            return null;
        }
        catch (MongoCommandException ex) when (ex.Code == 11000)
        {
            return null;
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
        services.AddScoped<IAvailabilityCalculator, AvailabilityCalculator>();
        services.AddScoped<ReservationService>();
        services.AddScoped<IIntegrationEventHandler<EmployeeScheduleUpdatedIntegrationEvent>, EmployeeScheduleSyncHandler>();
        services.AddScoped<IIntegrationEventHandler<ReservationCreatedIntegrationEvent>, ReservationEmailNotificationHandler>();
        services.AddScoped<IIntegrationEventHandler<ReservationCancelledIntegrationEvent>, ReservationEmailNotificationHandler>();
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
        string? slug,
        ITenantProvider tenant, IAvailabilityCalculator calculator,
        IMongoClient mongoClient, CancellationToken ct)
    {
        var businessId = tenant.BusinessId;
        var websiteId = tenant.WebsiteId;

        // WMS-009: Fallback to slug when tenant headers are missing
        if ((!businessId.HasValue || !websiteId.HasValue) && !string.IsNullOrWhiteSpace(slug))
        {
            var normalizedSlug = slug.Trim().ToLowerInvariant();
            var websitesCollection = mongoClient.GetDatabase("studio_business").GetCollection<BsonDocument>("WebsiteEntity");
            var websiteDoc = await websitesCollection.Find(
                Builders<BsonDocument>.Filter.Eq("DomainOrSlug", normalizedSlug)
            ).FirstOrDefaultAsync(ct);

            if (websiteDoc is not null)
            {
                if (websiteDoc.Contains("BusinessId")) businessId = websiteDoc["BusinessId"].AsGuid;
                if (websiteDoc.Contains("_id")) websiteId = websiteDoc["_id"].AsGuid;
            }
        }

        if (businessId is not Guid bId || websiteId is not Guid wId || durationMinutes <= 0)
            return Results.BadRequest("BusinessId and WebsiteId could not be determined.");

        return Results.Ok(await calculator.GetSlotsAsync(
            bId, wId, resourceId, date, durationMinutes, slotIntervalMinutes ?? 15, ct));
    }

    private static async Task<IResult> CreateReservationAsync(
        Reservation reservation, ITenantProvider tenant, ReservationService service,
        IEventBus eventBus, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId || tenant.WebsiteId is not Guid websiteId)
            return Results.BadRequest("Tenant headers are required.");
        reservation.BusinessId = businessId; reservation.WebsiteId = websiteId;
        var created = await service.CreateAsync(reservation, ct);
        if (created is null)
        {
            return Results.Conflict("The resource is already booked.");
        }

        // WMS-011: Publish event on booking success
        await eventBus.PublishAsync(new ReservationCreatedIntegrationEvent(
            created.Id,
            created.BusinessId,
            created.WebsiteId,
            created.ResourceId,
            created.ClientId,
            created.ClientSnapshot?.Name ?? string.Empty,
            created.ClientSnapshot?.Email ?? string.Empty,
            created.ClientSnapshot?.Phone,
            created.ServiceSnapshot?.ServiceName ?? string.Empty,
            created.StartAtUtc,
            created.EndAtUtc,
            created.ServiceSnapshot?.Price ?? 0m,
            created.Notes), ct);

        return Results.Created($"/api/agenda/reservations/{created.Id}", created);
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
        Guid id, ITenantProvider tenant, IMongoRepository<Reservation> repository,
        IEventBus eventBus, CancellationToken ct)
    {
        var reservation = await repository.GetByIdAsync(id, ct);
        if (reservation is null || reservation.BusinessId != tenant.BusinessId) return Results.NotFound();
        reservation.Status = nameof(ReservationStatus.Cancelled);
        await repository.ReplaceAsync(reservation, ct);

        // WMS-011: Publish event on cancellation
        await eventBus.PublishAsync(new ReservationCancelledIntegrationEvent(
            reservation.Id,
            reservation.BusinessId,
            reservation.WebsiteId,
            reservation.ResourceId,
            reservation.ClientId,
            reservation.ClientSnapshot?.Name ?? string.Empty,
            reservation.ClientSnapshot?.Email ?? string.Empty,
            reservation.ServiceSnapshot?.ServiceName ?? string.Empty,
            reservation.StartAtUtc,
            reservation.EndAtUtc), ct);

        return Results.Ok(reservation);
    }

    private static async Task<IResult> UpdateReservationAsync(
        Guid id, Reservation input, ITenantProvider tenant,
        IMongoRepository<Reservation> repository,
        IEventBus eventBus, CancellationToken ct)
    {
        var reservation = await repository.GetByIdAsync(id, ct);
        if (reservation is null || tenant.BusinessId is not Guid businessId || reservation.BusinessId != businessId)
            return Results.NotFound();

        if (!string.IsNullOrWhiteSpace(input.Status))
        {
            if (input.Status == nameof(ReservationStatus.Cancelled))
            {
                reservation.Status = nameof(ReservationStatus.Cancelled);
                await eventBus.PublishAsync(new ReservationCancelledIntegrationEvent(
                    reservation.Id,
                    reservation.BusinessId,
                    reservation.WebsiteId,
                    reservation.ResourceId,
                    reservation.ClientId,
                    reservation.ClientSnapshot?.Name ?? string.Empty,
                    reservation.ClientSnapshot?.Email ?? string.Empty,
                    reservation.ServiceSnapshot?.ServiceName ?? string.Empty,
                    reservation.StartAtUtc,
                    reservation.EndAtUtc), ct);
            }
            else if (input.Status is (nameof(ReservationStatus.Pending) or nameof(ReservationStatus.Confirmed) or nameof(ReservationStatus.Completed)))
            {
                reservation.Status = input.Status;
            }
            else
            {
                return Results.BadRequest("Unsupported reservation status.");
            }
        }

        if (input.Notes is not null)
            reservation.Notes = input.Notes;

        if (input.StartAtUtc != default && input.EndAtUtc != default)
        {
            reservation.StartAtUtc = input.StartAtUtc;
            reservation.EndAtUtc = input.EndAtUtc;
        }

        if (input.ResourceId != Guid.Empty)
        {
            reservation.ResourceId = input.ResourceId;
        }

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
