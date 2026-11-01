using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using StudioPlatform.Modules.Business.Domain;
using Xunit;

namespace StudioPlatform.Shared.Tests.Integration;

public sealed class PageLifecycleIntegrationTests : IClassFixture<StudioPlatformApiFactory>
{
    private readonly StudioPlatformApiFactory _factory;

    public PageLifecycleIntegrationTests(StudioPlatformApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PageLifecycle_Create_Update_Publish_ResolveBySlug()
    {
        var businessId = Guid.NewGuid();
        var websiteId = Guid.NewGuid();
        var ownerEmail = "owner@glamour.test";
        var websiteSlug = "glamour-nails";

        // Seed Business & Published Website
        var business = new BusinessEntity
        {
            Id = businessId,
            BusinessId = businessId,
            Name = "Glamour Nails Business",
            OwnerEmail = ownerEmail,
            SubscriptionTier = "Pro",
            IsActive = true
        };
        var website = new WebsiteEntity
        {
            Id = websiteId,
            BusinessId = businessId,
            Name = "Glamour Nails Site",
            DomainOrSlug = websiteSlug,
            Status = "Published"
        };

        _factory.GetRepository<BusinessEntity>().Seed(business);
        _factory.GetRepository<WebsiteEntity>().Seed(website);

        // Authenticated client as Developer or Owner
        var client = _factory.CreateAuthenticatedClient(businessId, websiteId, role: "Developer", email: ownerEmail);

        // 1. Create Page (POST /api/websites/{websiteId}/pages)
        var newPage = new WebsitePage
        {
            Title = "Our Treatments",
            Slug = "treatments",
            Status = "Draft",
            ShowInNavigation = true,
            Sections =
            [
                new PageSection
                {
                    Type = "hero",
                    Heading = "Luxury Nail Treatments",
                    Body = "Experience artisanal care.",
                    SortOrder = 0
                }
            ]
        };

        var createResponse = await client.PostAsJsonAsync($"/api/websites/{websiteId}/pages", newPage);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var createdPage = await createResponse.Content.ReadFromJsonAsync<WebsitePage>();
        Assert.NotNull(createdPage);
        Assert.NotEqual(Guid.Empty, createdPage.Id);
        Assert.Equal("treatments", createdPage.Slug);
        Assert.Equal("Draft", createdPage.Status);
        var pageId = createdPage.Id;

        // 2. Update Page (PUT /api/websites/{websiteId}/pages/{pageId})
        createdPage.Title = "Our Treatments & Spa Services";
        createdPage.Sections.Add(new PageSection
        {
            Type = "services",
            Heading = "Full Catalogue",
            SortOrder = 1
        });

        var updateResponse = await client.PutAsJsonAsync($"/api/websites/{websiteId}/pages/{pageId}", createdPage);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updatedPage = await updateResponse.Content.ReadFromJsonAsync<WebsitePage>();
        Assert.NotNull(updatedPage);
        Assert.Equal("Our Treatments & Spa Services", updatedPage.Title);
        Assert.Equal(2, updatedPage.Sections.Count);

        // 3. Publish Page (PUT /api/websites/{websiteId}/pages/{pageId} with Status = "Published")
        updatedPage.Status = "Published";
        var publishResponse = await client.PutAsJsonAsync($"/api/websites/{websiteId}/pages/{pageId}", updatedPage);
        Assert.Equal(HttpStatusCode.OK, publishResponse.StatusCode);

        var publishedPage = await publishResponse.Content.ReadFromJsonAsync<WebsitePage>();
        Assert.NotNull(publishedPage);
        Assert.Equal("Published", publishedPage.Status);

        // 4. Resolve Page via Slug (GET /api/websites/resolve/{slug}/{pageSlug}) - Public unauthenticated
        var publicClient = _factory.CreateClient();
        var resolveUrl = $"/api/websites/resolve/{websiteSlug}/treatments";
        var resolveResponse = await publicClient.GetAsync(resolveUrl);
        Assert.Equal(HttpStatusCode.OK, resolveResponse.StatusCode);

        var resolveJson = await resolveResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(resolveJson.TryGetProperty("isDraft", out var isDraftProp));
        Assert.False(isDraftProp.GetBoolean());

        Assert.True(resolveJson.TryGetProperty("page", out var resolvedPageProp));
        Assert.Equal("Our Treatments & Spa Services", resolvedPageProp.GetProperty("title").GetString());
        Assert.Equal("treatments", resolvedPageProp.GetProperty("slug").GetString());
        Assert.Equal("Published", resolvedPageProp.GetProperty("status").GetString());
    }
}

