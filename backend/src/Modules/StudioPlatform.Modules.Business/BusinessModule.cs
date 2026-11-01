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

        businesses.MapPost("/", CreateBusinessAsync);
        businesses.MapGet("/{id:guid}", GetBusinessAsync);
        businesses.MapPost("/{businessId:guid}/websites", CreateWebsiteAsync);
        websites.MapGet("/resolve", ResolveWebsiteAsync);
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
