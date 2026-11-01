using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace StudioPlatform.Shared.Tenancy;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext)
    {
        tenantContext.BusinessId = ResolveGuid(context, "X-Business-Id", "business_id", "BusinessId");
        tenantContext.WebsiteId = ResolveGuid(context, "X-Website-Id", "website_id", "WebsiteId");

        await next(context);
    }

    private static Guid? ResolveGuid(HttpContext context, string headerName, params string[] claimNames)
    {
        var value = context.Request.Headers[headerName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(value) && context.User.Identity?.IsAuthenticated == true)
        {
            value = claimNames
                .Select(name => context.User.FindFirst(name)?.Value)
                .FirstOrDefault(candidate => !string.IsNullOrWhiteSpace(candidate));
        }

        return Guid.TryParse(value, out var id) ? id : null;
    }
}
