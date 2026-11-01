using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Messaging;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Tenancy;

namespace StudioPlatform.Modules.Employees;

public sealed class EmployeeProfile : BaseEntity
{
    public List<Guid> AssignedWebsiteIds { get; set; } = [];
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? RoleTitle { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public string ColorHex { get; set; } = "#000000";
    public List<string> SkillTags { get; set; } = [];
    public bool IsActive { get; set; } = true;
}

public sealed class ScheduleWindow
{
    public DayOfWeek Day { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public TimeOnly? BreakStart { get; set; }
    public TimeOnly? BreakEnd { get; set; }
}

public sealed class EmployeeWeeklySchedule : BaseEntity
{
    public Guid EmployeeId { get; set; }
    public Guid? WebsiteId { get; set; }
    public List<ScheduleWindow> Windows { get; set; } = [];
}

public sealed class EmployeeModule : IModule
{
    public void RegisterModule(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMongoRepository<EmployeeProfile>("studio_employees");
        services.AddMongoRepository<EmployeeWeeklySchedule>("studio_employees");
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/employees/public", PublicAsync);
        endpoints.MapGet("/api/employees", ListAsync).RequireAuthorization();
        endpoints.MapPost("/api/employees", CreateAsync).RequireAuthorization();
        endpoints.MapPut("/api/employees/{id:guid}", UpdateAsync).RequireAuthorization();
        endpoints.MapPut("/api/employees/{id:guid}/schedule", ScheduleAsync).RequireAuthorization();
    }

    private static async Task<IResult> PublicAsync(
        ITenantProvider tenant, IMongoRepository<EmployeeProfile> repository, CancellationToken ct) =>
        tenant.BusinessId is Guid businessId && tenant.WebsiteId is Guid websiteId
            ? Results.Ok(await repository.FindAsync(
                employee => employee.BusinessId == businessId &&
                    employee.AssignedWebsiteIds.Contains(websiteId) && employee.IsActive, ct))
            : Results.BadRequest("X-Business-Id and X-Website-Id are required.");

    private static async Task<IResult> ListAsync(
        ITenantProvider tenant, IMongoRepository<EmployeeProfile> repository, CancellationToken ct) =>
        tenant.BusinessId is Guid businessId
            ? Results.Ok(await repository.FindAsync(employee => employee.BusinessId == businessId, ct))
            : Results.BadRequest("X-Business-Id is required.");

    private static async Task<IResult> CreateAsync(
        EmployeeProfile employee, ITenantProvider tenant,
        IMongoRepository<EmployeeProfile> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId)
            return Results.BadRequest("X-Business-Id is required.");
        employee.Id = Guid.NewGuid();
        employee.BusinessId = businessId;
        await repository.InsertAsync(employee, ct);
        return Results.Created($"/api/employees/{employee.Id}", employee);
    }

    private static async Task<IResult> UpdateAsync(
        Guid id, EmployeeProfile input, ITenantProvider tenant,
        IMongoRepository<EmployeeProfile> repository, CancellationToken ct)
    {
        var existing = await repository.GetByIdAsync(id, ct);
        if (existing is null || existing.BusinessId != tenant.BusinessId)
            return Results.NotFound();
        input.Id = id;
        input.BusinessId = existing.BusinessId;
        await repository.ReplaceAsync(input, ct);
        return Results.Ok(input);
    }

    private static async Task<IResult> ScheduleAsync(
        Guid id, EmployeeWeeklySchedule schedule, ITenantProvider tenant,
        IMongoRepository<EmployeeWeeklySchedule> repository,
        IEventBus eventBus, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId)
            return Results.BadRequest("X-Business-Id is required.");
        schedule.WebsiteId ??= tenant.WebsiteId;
        var existing = await repository.FirstOrDefaultAsync(
            item => item.EmployeeId == id && item.BusinessId == businessId &&
                item.WebsiteId == schedule.WebsiteId, ct);
        schedule.Id = existing?.Id ?? Guid.NewGuid();
        schedule.EmployeeId = id;
        schedule.BusinessId = businessId;
        if (existing is null) await repository.InsertAsync(schedule, ct);
        else await repository.ReplaceAsync(schedule, ct);
        await eventBus.PublishAsync(new EmployeeScheduleUpdatedIntegrationEvent(
            businessId, schedule.WebsiteId, id,
            schedule.Windows.Select(window => new WorkingWindowDto(
                window.Day, window.StartTime, window.EndTime)).ToList()), ct);
        return Results.Ok(schedule);
    }
}
