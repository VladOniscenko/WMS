using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using StudioPlatform.Modules.Business.Contracts;
using StudioPlatform.Modules.Business.Domain;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Business;

public sealed class BusinessModule : IModule
{
    private const string DatabaseName = "studio_business";

    public void RegisterModule(IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddMongoRepository<BusinessEntity>(DatabaseName)
            .AddMongoRepository<WebsiteEntity>(DatabaseName);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var businesses = endpoints.MapGroup("/api/businesses").WithTags("Businesses");
        var websites = endpoints.MapGroup("/api/websites").WithTags("Websites");

        businesses.MapPost("/", CreateBusinessAsync).RequireAuthorization("DeveloperOnly");
        businesses.MapGet("/", ListBusinessesAsync).RequireAuthorization("DeveloperOnly");
        businesses.MapGet("/{id:guid}", GetBusinessAsync).RequireAuthorization("DeveloperOnly");
        businesses.MapPut("/{id:guid}", UpdateBusinessAsync).RequireAuthorization("DeveloperOnly");
        businesses.MapPost("/{businessId:guid}/websites", CreateWebsiteAsync).RequireAuthorization("DeveloperOnly");
        websites.MapPut("/{id:guid}", UpdateWebsiteAsync).RequireAuthorization("DeveloperOnly");
        websites.MapGet("/", ListWebsitesAsync).RequireAuthorization("DeveloperOnly");
        websites.MapGet("/resolve", ResolveWebsiteAsync);
    }

    private static async Task<IResult> ListBusinessesAsync(
        IMongoRepository<BusinessEntity> businessRepository,
        IMongoRepository<WebsiteEntity> websiteRepository,
        CancellationToken cancellationToken)
    {
        var businesses = await businessRepository.FindAsync(_ => true, cancellationToken);
        var websites = await websiteRepository.FindAsync(_ => true, cancellationToken);
        return Results.Ok(businesses.Select(b => new BusinessSummaryResponse(
            b.Id, b.Name, b.OwnerEmail, b.SubscriptionTier, b.IsActive,
            websites.Count(w => w.BusinessId == b.Id),
            websites.Where(w => w.BusinessId == b.Id).ToList())));
    }

    private static async Task<IResult> UpdateBusinessAsync(
        Guid id, UpdateBusinessRequest request,
        IMongoRepository<BusinessEntity> repository,
        CancellationToken cancellationToken)
    {
        var business = await repository.GetByIdAsync(id, cancellationToken);
        if (business is null) return Results.NotFound();
        business.Name = request.Name;
        business.OwnerEmail = request.OwnerEmail;
        business.SubscriptionTier = request.SubscriptionTier;
        business.IsActive = request.IsActive;
        await repository.ReplaceAsync(business, cancellationToken);
        return Results.Ok(business);
    }

    private static async Task<IResult> CreateBusinessAsync(
        CreateBusinessRequest request,
        IMongoRepository<BusinessEntity> repository,
        CancellationToken cancellationToken)
    {
        var business = new BusinessEntity
        {
            Id = Guid.NewGuid(),
            BusinessId = Guid.Empty,
            Name = request.Name,
            OwnerEmail = request.OwnerEmail,
            SubscriptionTier = string.IsNullOrWhiteSpace(request.SubscriptionTier)
                ? "Free"
                : request.SubscriptionTier,
            IsActive = true
        };
        business.BusinessId = business.Id;

        await repository.InsertAsync(business, cancellationToken);
        return Results.Created($"/api/businesses/{business.Id}", business);
    }

    private static async Task<IResult> GetBusinessAsync(
        Guid id,
        IMongoRepository<BusinessEntity> businessRepository,
        IMongoRepository<WebsiteEntity> websiteRepository,
        CancellationToken cancellationToken)
    {
        var business = await businessRepository.GetByIdAsync(id, cancellationToken);
        if (business is null)
        {
            return Results.NotFound();
        }

        var websites = await websiteRepository.GetByBusinessIdAsync(id, cancellationToken);
        return Results.Ok(new BusinessDetailsResponse(
            business.Id,
            business.Name,
            business.OwnerEmail,
            business.SubscriptionTier,
            business.IsActive,
            websites));
    }

    private static async Task<IResult> CreateWebsiteAsync(
        Guid businessId,
        CreateWebsiteRequest request,
        IMongoRepository<BusinessEntity> businessRepository,
        IMongoRepository<WebsiteEntity> websiteRepository,
        CancellationToken cancellationToken)
    {
        if (await businessRepository.GetByIdAsync(businessId, cancellationToken) is null)
        {
            return Results.NotFound(new { message = "Business was not found." });
        }

        var website = new WebsiteEntity
        {
            Id = Guid.NewGuid(),
            BusinessId = businessId,
            Name = request.Name,
            DomainOrSlug = request.DomainOrSlug,
            EnabledModules = request.EnabledModules ?? [],
            ThemeConfig = request.ThemeConfig ?? new ThemeConfig()
        };

        await websiteRepository.InsertAsync(website, cancellationToken);
        return Results.Created($"/api/websites/resolve?slug={website.DomainOrSlug}", website);
    }

    private static async Task<IResult> ListWebsitesAsync(
        IMongoRepository<WebsiteEntity> repository,
        CancellationToken cancellationToken) =>
        Results.Ok(await repository.FindAsync(_ => true, cancellationToken));

    private static async Task<IResult> UpdateWebsiteAsync(
        Guid id, UpdateWebsiteRequest request,
        IMongoRepository<WebsiteEntity> repository,
        CancellationToken cancellationToken)
    {
        var website = await repository.GetByIdAsync(id, cancellationToken);
        if (website is null) return Results.NotFound();
        website.Name = request.Name;
        website.DomainOrSlug = request.DomainOrSlug;
        website.EnabledModules = request.EnabledModules;
        website.ThemeConfig = request.ThemeConfig;
        await repository.ReplaceAsync(website, cancellationToken);
        return Results.Ok(website);
    }

    private static async Task<IResult> ResolveWebsiteAsync(
        string slug,
        IMongoRepository<WebsiteEntity> websiteRepository,
        CancellationToken cancellationToken)
    {
        var website = await websiteRepository.FirstOrDefaultAsync(
            website => website.DomainOrSlug == slug,
            cancellationToken);
        return website is null
            ? Results.NotFound()
            : Results.Ok(new WebsiteResolutionResponse(
                website.BusinessId,
                website.Id,
                website.ThemeConfig,
                website.EnabledModules));
    }
}
