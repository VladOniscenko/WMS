using StudioPlatform.Modules.Business.Domain;
using StudioPlatform.Modules.Core.Domain;
using StudioPlatform.Modules.Auth;
using StudioPlatform.Modules.Employees;
using StudioPlatform.Shared.Contracts;
using StudioPlatform.Shared.Messaging;
using StudioPlatform.Shared.Persistence;

public sealed class DemoDataSeeder(
    IServiceScopeFactory scopeFactory,
    ILogger<DemoDataSeeder> logger) : IHostedService
{
    private static readonly Guid BusinessId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid CenterId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid SouthId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private const string DeveloperEmail = "vladislavssmine@gmail.com";

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var businesses = scope.ServiceProvider.GetRequiredService<IMongoRepository<BusinessEntity>>();
        var websites = scope.ServiceProvider.GetRequiredService<IMongoRepository<WebsiteEntity>>();
        var employees = scope.ServiceProvider.GetRequiredService<IMongoRepository<EmployeeProfile>>();
        var services = scope.ServiceProvider.GetRequiredService<IMongoRepository<CatalogServiceItem>>();
        var identities = scope.ServiceProvider.GetRequiredService<IMongoRepository<AuthIdentity>>();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();
        var developer = await identities.FirstOrDefaultAsync(
            identity => identity.BusinessId == Guid.Empty && identity.Email == DeveloperEmail,
            cancellationToken);
        if (developer is null)
            await identities.InsertAsync(new AuthIdentity
            {
                Id = Guid.NewGuid(),
                BusinessId = Guid.Empty,
                Email = DeveloperEmail,
                Roles = ["Developer"]
            }, cancellationToken);

        if (await businesses.GetByIdAsync(BusinessId, cancellationToken) is not null)
        {
            foreach (var existingWebsite in await websites.GetByBusinessIdAsync(BusinessId, cancellationToken))
            {
                if (existingWebsite.Status != "Published")
                {
                    existingWebsite.Status = "Published";
                    existingWebsite.PublishedAtUtc = DateTime.UtcNow;
                    await websites.ReplaceAsync(existingWebsite, cancellationToken);
                }
            }

            // Ensure existing employees have ServiceIds populated if empty
            var existingServices = await services.GetByBusinessIdAsync(BusinessId, cancellationToken);
            var existingServiceIds = existingServices.Select(s => s.Id).ToList();
            if (existingServiceIds.Count > 0)
            {
                var existingEmployees = await employees.GetByBusinessIdAsync(BusinessId, cancellationToken);
                foreach (var emp in existingEmployees)
                {
                    if (emp.ServiceIds.Count == 0)
                    {
                        emp.ServiceIds = existingServiceIds;
                        await employees.ReplaceAsync(emp, cancellationToken);
                    }
                }
            }
            return;
        }

        await businesses.InsertAsync(new BusinessEntity { Id = BusinessId, BusinessId = BusinessId, Name = "Glow Beauty Group", OwnerEmail = "owner@glow-nails.test", SubscriptionTier = "Professional" }, cancellationToken);
        foreach (var website in new[]
        {
            new WebsiteEntity { Id = CenterId, BusinessId = BusinessId, Name = "Glow Nail Studio - Center", DomainOrSlug = "glow-center", Status = "Published", EnabledModules = ["cms", "employees", "customers", "agenda"] },
            new WebsiteEntity { Id = SouthId, BusinessId = BusinessId, Name = "Glow Nail Studio - South", DomainOrSlug = "glow-south", Status = "Published", EnabledModules = ["cms", "employees", "customers", "agenda"] },
        }) await websites.InsertAsync(website, cancellationToken);

        var createdServiceIds = new List<Guid>();
        foreach (var service in new[]
        {
            ("BIAB Manicure", 60, 55m), ("Gel Polish", 45, 45m), ("Acrylic Full Set", 120, 85m),
            ("Spa Pedicure", 60, 60m), ("Nail Art", 30, 25m)
        })
        {
            foreach (var websiteId in new[] { CenterId, SouthId })
            {
                var serviceItem = new CatalogServiceItem { Id = Guid.NewGuid(), BusinessId = BusinessId, WebsiteId = websiteId, Name = service.Item1, DurationMinutes = service.Item2, Price = service.Item3, Currency = "EUR", Category = "Nails" };
                await services.InsertAsync(serviceItem, cancellationToken);
                createdServiceIds.Add(serviceItem.Id);
            }
        }

        var names = new[] { ("Mia Laurent", "mia@glow-nails.test"), ("Sofia Chen", "sofia@glow-nails.test"), ("Amara Jones", "amara@glow-nails.test") };
        foreach (var (name, email) in names)
        {
            var employee = new EmployeeProfile
            {
                Id = Guid.NewGuid(),
                BusinessId = BusinessId,
                Email = email,
                DisplayName = name,
                RoleTitle = "Senior Nail Artist",
                Bio = "Specialist in modern nail design.",
                AssignedWebsiteIds = [CenterId, SouthId],
                ServiceIds = createdServiceIds.Distinct().ToList(),
                SkillTags = ["BIAB", "Gel", "Nail Art"],
                ColorHex = "#c26d8b"
            };
            await employees.InsertAsync(employee, cancellationToken);
            var windows = Enumerable.Range(1, 6).Select(day => new WorkingWindowDto((DayOfWeek)day, new TimeOnly(9, 0), new TimeOnly(18, 0))).ToList();
            await eventBus.PublishAsync(new EmployeeScheduleUpdatedIntegrationEvent(BusinessId, CenterId, employee.Id, windows), cancellationToken);
            await eventBus.PublishAsync(new EmployeeScheduleUpdatedIntegrationEvent(BusinessId, SouthId, employee.Id, windows), cancellationToken);
        }

        logger.LogInformation("Seeded Glow Beauty Group demo data.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
