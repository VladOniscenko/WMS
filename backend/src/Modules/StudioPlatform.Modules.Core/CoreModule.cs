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
        endpoints.MapGet("/api/cms/pages/{pageKey}", GetSectionsAsync);
        endpoints.MapPut("/api/cms/pages/{pageKey}", ReplaceSectionsAsync);
        endpoints.MapGet("/api/catalog/services", GetServicesAsync);
        endpoints.MapPost("/api/catalog/services", CreateServiceAsync);
        endpoints.MapPut("/api/catalog/services/{id:guid}", UpdateServiceAsync);
        endpoints.MapDelete("/api/catalog/services/{id:guid}", DeleteServiceAsync);
    }

    private static async Task<IResult> GetSectionsAsync(
        string pageKey, ITenantProvider tenant, IMongoRepository<CmsPageSection> repository,
        CancellationToken ct)
    {
        if (tenant.WebsiteId is not Guid websiteId) return Results.BadRequest("X-Website-Id is required.");
        var sections = await repository.FindAsync(x => x.BusinessId == (tenant.BusinessId ?? Guid.Empty)
            && x.WebsiteId == websiteId && x.PageKey == pageKey, ct);
        return Results.Ok(sections.OrderBy(x => x.Order));
    }

    private static async Task<IResult> ReplaceSectionsAsync(
        string pageKey,         List<CmsPageSectionRequest> sections, ITenantProvider tenant,
        IMongoRepository<CmsPageSection> repository, CancellationToken ct)
    {
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

    private static async Task<IResult> GetServicesAsync(ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct) =>
        tenant.BusinessId is Guid b && tenant.WebsiteId is Guid w
            ? Results.Ok(await repository.FindAsync(x => x.BusinessId == b && x.WebsiteId == w, ct))
            : Results.BadRequest("Tenant headers are required.");

    private static async Task<IResult> CreateServiceAsync(CatalogServiceItem item, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid b || tenant.WebsiteId is not Guid w) return Results.BadRequest("Tenant headers are required.");
        item.Id = Guid.NewGuid(); item.BusinessId = b; item.WebsiteId = w;
        await repository.InsertAsync(item, ct);
        return Results.Created($"/api/catalog/services/{item.Id}", item);
    }

    private static async Task<IResult> UpdateServiceAsync(Guid id, CatalogServiceItem item, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        if (tenant.BusinessId is not Guid b || tenant.WebsiteId is not Guid w) return Results.BadRequest("Tenant headers are required.");
        var existing = await repository.GetByIdAsync(id, ct);
        if (existing is null || existing.BusinessId != b || existing.WebsiteId != w) return Results.NotFound();
        item.Id = id; item.BusinessId = b; item.WebsiteId = w;
        await repository.ReplaceAsync(item, ct); return Results.Ok(item);
    }

    private static async Task<IResult> DeleteServiceAsync(Guid id, ITenantProvider tenant, IMongoRepository<CatalogServiceItem> repository, CancellationToken ct)
    {
        var existing = await repository.GetByIdAsync(id, ct);
        if (existing is null || existing.BusinessId != tenant.BusinessId || existing.WebsiteId != tenant.WebsiteId) return Results.NotFound();
        await repository.DeleteAsync(id, ct); return Results.NoContent();
    }
}
