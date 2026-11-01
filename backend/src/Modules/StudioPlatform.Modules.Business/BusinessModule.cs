using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using System.Security.Claims;
using Microsoft.AspNetCore.Hosting;
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
            .AddMongoRepository<WebsiteEntity>(DatabaseName)
            .AddMongoRepository<WebsiteInvitation>(DatabaseName)
            .AddMongoRepository<WebsitePage>(DatabaseName);
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var businesses = endpoints.MapGroup("/api/businesses").WithTags("Businesses");
        var websites = endpoints.MapGroup("/api/websites").WithTags("Websites");

        businesses.MapPost("/", CreateBusinessAsync).RequireAuthorization();
        businesses.MapGet("/", ListBusinessesAsync).RequireAuthorization();
        businesses.MapGet("/{id:guid}", GetBusinessAsync).RequireAuthorization();
        businesses.MapPut("/{id:guid}", UpdateBusinessAsync).RequireAuthorization();
        businesses.MapPost("/{businessId:guid}/websites", CreateWebsiteAsync).RequireAuthorization();
        websites.MapPut("/{id:guid}", UpdateWebsiteAsync).RequireAuthorization();
        websites.MapPost("/{id:guid}/publish", PublishWebsiteAsync).RequireAuthorization();
        websites.MapPost("/{id:guid}/unpublish", UnpublishWebsiteAsync).RequireAuthorization();
        websites.MapGet("/", ListWebsitesAsync).RequireAuthorization();
        websites.MapPost("/", CreateWebsiteForAccountAsync).RequireAuthorization();
        websites.MapPost("/{id:guid}/invitations", InviteAsync).RequireAuthorization();
        websites.MapGet("/{id:guid}/invitations", ListInvitationsAsync).RequireAuthorization();
        websites.MapPost("/invitations/{invitationId:guid}/accept", AcceptInviteAsync).RequireAuthorization();
        websites.MapGet("/{id:guid}/pages", ListPagesAsync).RequireAuthorization();
        websites.MapPost("/{id:guid}/pages", CreatePageAsync).RequireAuthorization();
        websites.MapPut("/{id:guid}/pages/{pageId:guid}", UpdatePageAsync).RequireAuthorization();
        websites.MapDelete("/{id:guid}/pages/{pageId:guid}", DeletePageAsync).RequireAuthorization();
        websites.MapGet("/resolve", ResolveWebsiteAsync);
        websites.MapGet("/resolve/{slug}/{pageSlug}", ResolvePageAsync);
        endpoints.MapPost("/api/assets", UploadAssetAsync).RequireAuthorization().DisableAntiforgery();
    }

    private static async Task<IResult> ListBusinessesAsync(
        IMongoRepository<BusinessEntity> businessRepository,
        IMongoRepository<WebsiteEntity> websiteRepository,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var ownerEmail = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        var businesses = user.IsInRole("Developer")
            ? await businessRepository.FindAsync(_ => true, cancellationToken)
            : await businessRepository.FindAsync(x => x.OwnerEmail == ownerEmail, cancellationToken);
        var websites = await websiteRepository.FindAsync(_ => true, cancellationToken);
        return Results.Ok(businesses.Select(b => new BusinessSummaryResponse(
            b.Id, b.Name, b.OwnerEmail, b.SubscriptionTier, b.IsActive,
            websites.Count(w => w.BusinessId == b.Id),
            websites.Where(w => w.BusinessId == b.Id).ToList())));
    }

    private static async Task<IResult> UpdateBusinessAsync(
        Guid id, UpdateBusinessRequest request,
        ClaimsPrincipal user,
        IMongoRepository<BusinessEntity> repository,
        CancellationToken cancellationToken)
    {
        var business = await repository.GetByIdAsync(id, cancellationToken);
        if (business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
            return Results.NotFound();
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
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        if (string.IsNullOrWhiteSpace(email) ||
            (!user.IsInRole("Developer") && !string.Equals(email, request.OwnerEmail, StringComparison.OrdinalIgnoreCase)))
            return Results.Forbid();
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
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var business = await businessRepository.GetByIdAsync(id, cancellationToken);
        if (business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
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
        IMongoRepository<WebsitePage> pages,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var business = await businessRepository.GetByIdAsync(businessId, cancellationToken);
        if (business is null)
        {
            return Results.NotFound(new { message = "Business was not found." });
        }
        if (!user.IsInRole("Developer") && !IsOwner(user, business))
            return Results.NotFound();

        var website = new WebsiteEntity
        {
            Id = Guid.NewGuid(),
            BusinessId = businessId,
            Name = request.Name,
            DomainOrSlug = NormalizeSlug(request.DomainOrSlug),
            TemplateId = string.IsNullOrWhiteSpace(request.TemplateId) ? "editorial" : request.TemplateId,
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Other" : request.Category,
            EnabledModules = request.EnabledModules ?? [],
            ThemeConfig = request.ThemeConfig ?? new ThemeConfig(),
            Content = request.Content ?? new WebsiteContent { Title = request.Name },
            ServiceIds = request.ServiceIds ?? []
        };

        await websiteRepository.InsertAsync(website, cancellationToken);
        await pages.InsertAsync(new WebsitePage
        {
            Id = Guid.NewGuid(),
            WebsiteId = website.Id,
            Slug = "home",
            Title = "Home",
            Sections = TemplateSections(website.TemplateId, request.Name, website.Content.HeroText)
        }, cancellationToken);
        return Results.Created($"/api/websites/resolve?slug={website.DomainOrSlug}", website);
    }

    private static List<PageSection> TemplateSections(string templateId, string name, string? heroText) =>
        templateId switch
        {
            "minimal" =>
            [
                new PageSection { Type = "hero", Heading = name, Body = heroText ?? "A considered space for your next appointment.", SortOrder = 0 },
                new PageSection { Type = "text", Heading = "A calmer way to care for yourself", Body = "Thoughtful service, beautiful details, and time that is yours.", SortOrder = 1 },
                new PageSection { Type = "services", Heading = "Services", SortOrder = 2 },
                new PageSection { Type = "contact", Heading = "Visit us", SortOrder = 3 }
            ],
            "playful" =>
            [
                new PageSection { Type = "hero", Heading = name, Body = heroText ?? "Colour, care, and a little joy in every appointment.", SortOrder = 0 },
                new PageSection { Type = "gallery", Heading = "Recent work", SortOrder = 1 },
                new PageSection { Type = "services", Heading = "Pick your next look", SortOrder = 2 },
                new PageSection { Type = "booking", Heading = "Ready when you are", SortOrder = 3 }
            ],
            _ =>
            [
                new PageSection { Type = "hero", Heading = name, Body = heroText ?? "Beautiful work, thoughtfully delivered.", SortOrder = 0 },
                new PageSection { Type = "services", Heading = "Our services", SortOrder = 1 },
                new PageSection { Type = "employees", Heading = "Meet the team", SortOrder = 2 },
                new PageSection { Type = "contact", Heading = "Get in touch", SortOrder = 3 }
            ]
        };

    private static async Task<IResult> ListWebsitesAsync(
        IMongoRepository<WebsiteEntity> repository,
        IMongoRepository<WebsiteInvitation> invitations,
        IMongoRepository<BusinessEntity> businesses,
        ClaimsPrincipal user,
        CancellationToken cancellationToken) =>
        Results.Ok(user.IsInRole("Developer")
            ? await repository.FindAsync(_ => true, cancellationToken)
            : await GetAccessibleWebsitesAsync(repository, invitations, businesses, user, cancellationToken));

    private static async Task<IResult> CreateWebsiteForAccountAsync(
        CreateWebsiteRequest request,
        IMongoRepository<BusinessEntity> businessRepository,
        IMongoRepository<WebsiteEntity> websiteRepository,
        IMongoRepository<WebsitePage> pages,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        if (string.IsNullOrWhiteSpace(email))
            return Results.Unauthorized();

        var owner = await businessRepository.FirstOrDefaultAsync(
            item => item.OwnerEmail == email, cancellationToken);
        if (owner is null)
        {
            owner = new BusinessEntity
            {
                Id = Guid.NewGuid(),
                BusinessId = Guid.Empty,
                Name = request.Name,
                OwnerEmail = email,
                SubscriptionTier = "Free",
                IsActive = true
            };
            owner.BusinessId = owner.Id;
            await businessRepository.InsertAsync(owner, cancellationToken);
        }

        return await CreateWebsiteAsync(
            owner.Id, request, businessRepository, websiteRepository, pages, user, cancellationToken);
    }

    private static async Task<IReadOnlyList<WebsiteEntity>> GetAccessibleWebsitesAsync(
        IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<WebsiteInvitation> invitations,
        IMongoRepository<BusinessEntity> businesses,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        var invited = await invitations.FindAsync(
            item => item.Email == email && item.Status == "Accepted", cancellationToken);
        var owned = await businesses.FindAsync(
            item => item.OwnerEmail == email, cancellationToken);
        return await websites.FindAsync(
            website => owned.Any(item => item.Id == website.BusinessId) ||
                invited.Any(item => item.WebsiteId == website.Id), cancellationToken);
    }

    private static async Task<IResult> UpdateWebsiteAsync(
        Guid id, UpdateWebsiteRequest request,
        ClaimsPrincipal user,
        IMongoRepository<BusinessEntity> businessRepository,
        IMongoRepository<WebsiteEntity> repository,
        CancellationToken cancellationToken)
    {
        var website = await repository.GetByIdAsync(id, cancellationToken);
        if (website is null) return Results.NotFound();
        var business = await businessRepository.GetByIdAsync(website.BusinessId, cancellationToken);
        if (business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
            return Results.NotFound();
        website.Name = request.Name;
        website.DomainOrSlug = NormalizeSlug(request.DomainOrSlug);
        website.EnabledModules = request.EnabledModules;
        website.ThemeConfig = request.ThemeConfig;
        website.Content = request.Content ?? website.Content;
        website.ServiceIds = request.ServiceIds ?? website.ServiceIds;
        website.Category = request.Category ?? website.Category;
        await repository.ReplaceAsync(website, cancellationToken);
        return Results.Ok(website);
    }

    private static async Task<IResult> PublishWebsiteAsync(
        Guid id, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, IMongoRepository<WebsitePage> pages,
        CancellationToken cancellationToken)
    {
        var website = await websites.GetByIdAsync(id, cancellationToken);
        if (website is null) return Results.NotFound();
        var business = await businesses.GetByIdAsync(website.BusinessId, cancellationToken);
        if (business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
            return Results.Forbid();
        website.Status = "Published";
        website.PublishedAtUtc = DateTime.UtcNow;
        await websites.ReplaceAsync(website, cancellationToken);
        var websitePages = await pages.FindAsync(page => page.WebsiteId == id, cancellationToken);
        foreach (var page in websitePages)
        {
            page.Status = "Published";
            await pages.ReplaceAsync(page, cancellationToken);
        }
        return Results.Ok(website);
    }

    private static async Task<IResult> UnpublishWebsiteAsync(
        Guid id, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, IMongoRepository<WebsitePage> pages,
        CancellationToken cancellationToken)
    {
        var website = await websites.GetByIdAsync(id, cancellationToken);
        if (website is null) return Results.NotFound();
        var business = await businesses.GetByIdAsync(website.BusinessId, cancellationToken);
        if (business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
            return Results.Forbid();
        website.Status = "Draft";
        website.PublishedAtUtc = null;
        await websites.ReplaceAsync(website, cancellationToken);
        var websitePages = await pages.FindAsync(page => page.WebsiteId == id, cancellationToken);
        foreach (var page in websitePages)
        {
            page.Status = "Draft";
            await pages.ReplaceAsync(page, cancellationToken);
        }
        return Results.Ok(website);
    }

    private static async Task<IResult> InviteAsync(
        Guid id, WebsiteInvitation invitation, ClaimsPrincipal user,
        IMongoRepository<WebsiteEntity> websites, IMongoRepository<BusinessEntity> businesses,
        IMongoRepository<WebsiteInvitation> invitations, CancellationToken cancellationToken)
    {
        var website = await websites.GetByIdAsync(id, cancellationToken);
        var business = website is null ? null : await businesses.GetByIdAsync(website.BusinessId, cancellationToken);
        if (website is null || business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
            return Results.Forbid();
        invitation.Id = Guid.NewGuid();
        invitation.WebsiteId = website.Id;
        invitation.BusinessId = website.BusinessId;
        invitation.Email = invitation.Email.ToLowerInvariant();
        invitation.Status = "Pending";
        await invitations.InsertAsync(invitation, cancellationToken);
        return Results.Created($"/api/websites/{id}/invitations/{invitation.Id}", invitation);
    }

    private static async Task<IResult> ListInvitationsAsync(
        Guid id, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, IMongoRepository<WebsiteInvitation> invitations,
        CancellationToken cancellationToken)
    {
        var website = await websites.GetByIdAsync(id, cancellationToken);
        var business = website is null ? null : await businesses.GetByIdAsync(website.BusinessId, cancellationToken);
        if (website is null || business is null || (!user.IsInRole("Developer") && !IsOwner(user, business)))
            return Results.Forbid();
        return Results.Ok(await invitations.FindAsync(x => x.WebsiteId == id, cancellationToken));
    }

    private static async Task<IResult> AcceptInviteAsync(
        Guid invitationId, ClaimsPrincipal user, IMongoRepository<WebsiteInvitation> invitations,
        CancellationToken cancellationToken)
    {
        var email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email");
        var invitation = await invitations.GetByIdAsync(invitationId, cancellationToken);
        if (invitation is null || !string.Equals(invitation.Email, email, StringComparison.OrdinalIgnoreCase))
            return Results.NotFound();
        invitation.Status = "Accepted";
        invitation.AcceptedAtUtc = DateTime.UtcNow;
        await invitations.ReplaceAsync(invitation, cancellationToken);
        return Results.Ok(invitation);
    }

    private static async Task<IResult> ListPagesAsync(
        Guid id, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, IMongoRepository<WebsitePage> pages,
        CancellationToken cancellationToken)
    {
        if (!await CanManageWebsiteAsync(id, user, websites, businesses, cancellationToken))
            return Results.Forbid();
        return Results.Ok(await pages.FindAsync(page => page.WebsiteId == id, cancellationToken));
    }

    private static async Task<IResult> CreatePageAsync(
        Guid id, WebsitePage input, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, IMongoRepository<WebsitePage> pages,
        CancellationToken cancellationToken)
    {
        if (!await CanManageWebsiteAsync(id, user, websites, businesses, cancellationToken))
            return Results.Forbid();
        input.Id = Guid.NewGuid();
        input.WebsiteId = id;
        input.Slug = NormalizeSlug(input.Slug);
        input.Sections = input.Sections.OrderBy(section => section.SortOrder).ToList();
        await pages.InsertAsync(input, cancellationToken);
        return Results.Created($"/api/websites/{id}/pages/{input.Id}", input);
    }

    private static async Task<IResult> UpdatePageAsync(
        Guid id, Guid pageId, WebsitePage input, ClaimsPrincipal user,
        IMongoRepository<WebsiteEntity> websites, IMongoRepository<BusinessEntity> businesses,
        IMongoRepository<WebsitePage> pages, CancellationToken cancellationToken)
    {
        if (!await CanManageWebsiteAsync(id, user, websites, businesses, cancellationToken))
            return Results.Forbid();
        var existing = await pages.GetByIdAsync(pageId, cancellationToken);
        if (existing is null || existing.WebsiteId != id) return Results.NotFound();
        existing.Title = input.Title;
        existing.Slug = NormalizeSlug(input.Slug);
        existing.ShowInNavigation = input.ShowInNavigation;
        existing.Status = input.Status;
        existing.SeoDescription = input.SeoDescription;
        existing.Sections = input.Sections.OrderBy(section => section.SortOrder).ToList();
        await pages.ReplaceAsync(existing, cancellationToken);
        return Results.Ok(existing);
    }

    private static async Task<IResult> DeletePageAsync(
        Guid id, Guid pageId, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, IMongoRepository<WebsitePage> pages,
        CancellationToken cancellationToken)
    {
        if (!await CanManageWebsiteAsync(id, user, websites, businesses, cancellationToken))
            return Results.Forbid();
        var page = await pages.GetByIdAsync(pageId, cancellationToken);
        if (page is null || page.WebsiteId != id) return Results.NotFound();
        await pages.DeleteAsync(pageId, cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ResolvePageAsync(
        string slug, string pageSlug, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<WebsitePage> pages, CancellationToken cancellationToken)
    {
        var website = await websites.FirstOrDefaultAsync(
            item => item.DomainOrSlug == slug && item.Status == "Published", cancellationToken);
        if (website is null) return Results.NotFound();
        var page = await pages.FirstOrDefaultAsync(
            item => item.WebsiteId == website.Id && item.Slug == pageSlug && item.Status == "Published",
            cancellationToken);
        if (page is null && string.Equals(pageSlug, "home", StringComparison.OrdinalIgnoreCase))
        {
            page = (await pages.FindAsync(
                item => item.WebsiteId == website.Id && item.Status == "Published",
                cancellationToken)).OrderBy(item => item.Slug == "home" ? 0 : 1).ThenBy(item => item.Title).FirstOrDefault();
        }
        return page is null
            ? Results.NotFound()
            : Results.Ok(new { website.BusinessId, website.Id, website.ThemeConfig, website.Content, page });
    }

    private static async Task<IResult> UploadAssetAsync(
        IFormFile file, IWebHostEnvironment environment, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > 10 * 1024 * 1024)
            return Results.BadRequest("Images must be between 1 byte and 10 MB.");
        var allowed = new[] { "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml" };
        if (!allowed.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            return Results.BadRequest("Only JPEG, PNG, WebP, GIF, and SVG images are supported.");
        var root = Path.Combine(environment.ContentRootPath, "uploads");
        Directory.CreateDirectory(root);
        var extension = file.ContentType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            "image/svg+xml" => ".svg",
            _ => ".bin"
        };
        var name = $"{Guid.NewGuid():N}{extension}";
        await using var stream = File.Create(Path.Combine(root, name));
        await file.CopyToAsync(stream, cancellationToken);
        return Results.Ok(new { url = $"/uploads/{name}" });
    }

    private static async Task<bool> CanManageWebsiteAsync(
        Guid websiteId, ClaimsPrincipal user, IMongoRepository<WebsiteEntity> websites,
        IMongoRepository<BusinessEntity> businesses, CancellationToken cancellationToken)
    {
        var website = await websites.GetByIdAsync(websiteId, cancellationToken);
        if (website is null) return false;
        var business = await businesses.GetByIdAsync(website.BusinessId, cancellationToken);
        return business is not null && (user.IsInRole("Developer") || IsOwner(user, business));
    }

    private static string NormalizeSlug(string slug) =>
        string.Join('-', slug.Trim().ToLowerInvariant().Split(
            [' ', '/', '\\'], StringSplitOptions.RemoveEmptyEntries));

    private static async Task<IResult> ResolveWebsiteAsync(
        string slug,
        IMongoRepository<WebsiteEntity> websiteRepository,
        CancellationToken cancellationToken)
    {
        var website = await websiteRepository.FirstOrDefaultAsync(
            website => website.DomainOrSlug == slug && website.Status == "Published",
            cancellationToken);
        return website is null
            ? Results.NotFound()
            : Results.Ok(new WebsiteResolutionResponse(
                website.BusinessId,
                website.Id,
                website.ThemeConfig,
                website.EnabledModules,
                website.Content));
    }

    private static bool IsOwner(ClaimsPrincipal user, BusinessEntity business) =>
        string.Equals(
            business.OwnerEmail,
            user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirstValue("email"),
            StringComparison.OrdinalIgnoreCase);
}
