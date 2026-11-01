using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using StudioPlatform.Modules.Core.Domain;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Tenancy;

namespace StudioPlatform.Modules.Core;

public sealed class CoreModule : IModule
{
    public void RegisterModule(IServiceCollection services, IConfiguration configuration) =>
        services.AddMongoRepository<CmsPageSection>("studio_cms")
            .AddMongoRepository<CatalogServiceItem>("studio_cms");

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        // Deprecated CMS endpoints (WMS-018: WebsitePage in BusinessModule is the unified CMS system)
        endpoints.MapGet("/api/cms/pages/{pageKey}", GetSectionsAsync)
            .WithTags("Deprecated CMS")
            .WithSummary("Deprecated: Use /api/websites/{id}/pages instead.")
            .WithMetadata(new ObsoleteAttribute("Use /api/websites/{id}/pages instead."));
        endpoints.MapPut("/api/cms/pages/{pageKey}", ReplaceSectionsAsync)
            .WithTags("Deprecated CMS")
            .WithSummary("Deprecated: Use /api/websites/{id}/pages instead.")
            .WithMetadata(new ObsoleteAttribute("Use /api/websites/{id}/pages instead."));

        // Unified Service Catalog endpoints (WMS-018 & WMS-025)
        var catalog = endpoints.MapGroup("/api/catalog/services").WithTags("Catalog Services");
        catalog.MapGet("/", GetServicesAsync);
        catalog.MapPost("/", CreateServiceAsync);
        catalog.MapPut("/{id:guid}", UpdateServiceAsync);
        catalog.MapDelete("/{id:guid}", DeleteServiceAsync);
    }

    private static async Task<IResult> GetSectionsAsync(
        string pageKey, ITenantProvider tenant, IMongoRepository<CmsPageSection> repository,
        HttpResponse response, CancellationToken ct)
    {
        response.Headers.Append("X-Deprecated", "Use /api/websites/{id}/pages instead.");
        if (tenant.WebsiteId is not Guid websiteId) return Results.BadRequest("X-Website-Id is required.");
        var sections = await repository.FindAsync(x => x.BusinessId == (tenant.BusinessId ?? Guid.Empty)
            && x.WebsiteId == websiteId && x.PageKey == pageKey, ct);
        return Results.Ok(sections.OrderBy(x => x.Order));
    }

    private static async Task<IResult> ReplaceSectionsAsync(
        string pageKey, List<CmsPageSectionRequest> sections, ITenantProvider tenant,
        IMongoRepository<CmsPageSection> repository, HttpResponse response, CancellationToken ct)
    {
        response.Headers.Append("X-Deprecated", "Use /api/websites/{id}/pages instead.");
        if (tenant.BusinessId is not Guid businessId || tenant.WebsiteId is not Guid websiteId)
            return Results.BadRequest("X-Business-Id and X-Website-Id are required.");
        var entities = sections.Select(section => new CmsPageSection
        {
            Id = section.Id, SectionKey = section.SectionKey, ContentJson =
                section.ContentJson.GetRawText(), Order = section.Order
        }).ToList();
        foreach (var section in entities)
        {
            section.Id = section.Id == Guid.Empty ? Guid.NewGuid() : section.Id;
            section.BusinessId = businessId; section.WebsiteId = websiteId; section.PageKey = pageKey;
            var existing = await repository.GetByIdAsync(section.Id, ct);
            if (existing is null) await repository.InsertAsync(section, ct);
            else await repository.ReplaceAsync(section, ct);
        }
        return Results.Ok(entities);
    }

    public sealed record CmsPageSectionRequest(
        Guid Id, string SectionKey, JsonElement ContentJson, int Order);

    private static async Task<IResult> GetServicesAsync(
        Guid? websiteId, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid businessId)
            return Results.BadRequest("Tenant headers are required.");

        var targetWebsiteId = (websiteId.HasValue && websiteId.Value != Guid.Empty)
            ? websiteId
            : (tenant.WebsiteId.HasValue && tenant.WebsiteId.Value != Guid.Empty ? tenant.WebsiteId : null);

        if (targetWebsiteId.HasValue)
        {
            var scopedServices = await repository.FindAsync(
                x => x.BusinessId == businessId && x.WebsiteId == targetWebsiteId.Value, ct);
            return Results.Ok(scopedServices);
        }

        var allBusinessServices = await repository.FindAsync(x => x.BusinessId == businessId, ct);
        return Results.Ok(allBusinessServices);
    }

    private static async Task<IResult> CreateServiceAsync(
        CatalogServiceItem item, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        var businessId = item.BusinessId != Guid.Empty
            ? item.BusinessId
            : (tenant.BusinessId ?? Guid.Empty);

        if (businessId == Guid.Empty)
            return Results.BadRequest("BusinessId is required.");

        var websiteId = item.WebsiteId != Guid.Empty
            ? item.WebsiteId
            : (tenant.WebsiteId ?? Guid.Empty);

        if (websiteId == Guid.Empty)
            return Results.BadRequest("WebsiteId is required and cannot be empty.");

        item.Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id;
        item.BusinessId = businessId;
        item.WebsiteId = websiteId;

        await repository.InsertAsync(item, ct);
        return Results.Created($"/api/catalog/services/{item.Id}", item);
    }

    private static async Task<IResult> UpdateServiceAsync(
        Guid id, CatalogServiceItem item, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid b)
            return Results.BadRequest("Tenant headers are required.");

        var existing = await repository.GetByIdAsync(id, ct);
        if (existing is null || existing.BusinessId != b)
            return Results.NotFound();

        item.Id = id;
        item.BusinessId = b;
        item.WebsiteId = item.WebsiteId != Guid.Empty ? item.WebsiteId : existing.WebsiteId;
        await repository.ReplaceAsync(item, ct);
        return Results.Ok(item);
    }

    private static async Task<IResult> DeleteServiceAsync(
        Guid id, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid b)
            return Results.BadRequest("Tenant headers are required.");

        var existing = await repository.GetByIdAsync(id, ct);
        if (existing is null || existing.BusinessId != b)
            return Results.NotFound();

        await repository.DeleteAsync(id, ct);
        return Results.NoContent();
    }
}
