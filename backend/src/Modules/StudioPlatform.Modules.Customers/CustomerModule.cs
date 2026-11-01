using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MongoDB.Driver;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Messaging;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Persistence;
using StudioPlatform.Shared.Tenancy;

namespace StudioPlatform.Modules.Customers;
public sealed class CustomerProfile : BaseEntity { public Guid? AuthIdentityId { get; set; } public string Email { get; set; } = ""; public string? FirstName { get; set; } public string? LastName { get; set; } public string? Phone { get; set; } public string? Notes { get; set; } public bool ConsentMarketing { get; set; } public List<Guid> VisitedWebsiteIds { get; set; } = []; }
public sealed class CustomerModule : IModule
{
 public void RegisterModule(IServiceCollection s,IConfiguration c){s.AddMongoRepository<CustomerProfile>("studio_customers");s.AddSingleton<IHostedService,CustomerIndexInitializer>();s.AddScoped<IIntegrationEventHandler<StudioPlatform.Shared.Contracts.UserAuthenticatedIntegrationEvent>,UserAuthenticatedHandler>();}
 public void MapEndpoints(IEndpointRouteBuilder e){e.MapGet("/api/customers",List);e.MapPost("/api/customers",Create);e.MapGet("/api/customers/{id:guid}",Get);e.MapGet("/api/customers/me",Me).RequireAuthorization();e.MapPut("/api/customers/me",Update).RequireAuthorization();}
 static async Task<IResult> List(string? search,int page,int pageSize,ClaimsPrincipal user,ITenantProvider t,IMongoRepository<CustomerProfile> r,CancellationToken ct)
 {
  if(!IsStaff(user)||t.BusinessId is not Guid b)return Results.Forbid();
  page=Math.Max(1,page);pageSize=Math.Clamp(pageSize,1,100);
  var all=await r.FindAsync(x=>x.BusinessId==b&&(string.IsNullOrWhiteSpace(search)||x.Email.Contains(search)||
   (x.FirstName!=null&&x.FirstName.Contains(search))||(x.LastName!=null&&x.LastName.Contains(search))),ct);
  return Results.Ok(new{page,pageSize,total=all.Count,items=all.Skip((page-1)*pageSize).Take(pageSize)});
 }
 public sealed class CustomerIndexInitializer(IMongoClient client):IHostedService
 {
  public async Task StartAsync(CancellationToken ct)=>await client.GetDatabase("studio_customers").GetCollection<CustomerProfile>(nameof(CustomerProfile)).Indexes.CreateOneAsync(new CreateIndexModel<CustomerProfile>(Builders<CustomerProfile>.IndexKeys.Ascending(x=>x.BusinessId).Ascending(x=>x.Email),new CreateIndexOptions{Unique=true}),cancellationToken:ct);
  public Task StopAsync(CancellationToken ct)=>Task.CompletedTask;
 }
 static async Task<IResult> Create(CustomerProfile p,ClaimsPrincipal user,ITenantProvider t,IMongoRepository<CustomerProfile> r,CancellationToken ct){if(!IsStaff(user)||t.BusinessId is not Guid b)return Results.Forbid();p.Id=Guid.NewGuid();p.BusinessId=b;await r.InsertAsync(p,ct);return Results.Created($"/api/customers/{p.Id}",p);}
 static async Task<IResult> Get(Guid id,ClaimsPrincipal user,IMongoRepository<CustomerProfile> r,ITenantProvider t,CancellationToken ct){var p=await r.GetByIdAsync(id,ct);return !IsStaff(user)||p is null||p.BusinessId!=t.BusinessId?Results.NotFound():Results.Ok(p);}
 static async Task<IResult> Me(ClaimsPrincipal u,IMongoRepository<CustomerProfile> r,ITenantProvider t,CancellationToken ct)=>await FindIdentity(u,r,t,ct);
 static async Task<IResult> Update(CustomerProfile input,ClaimsPrincipal u,IMongoRepository<CustomerProfile> r,ITenantProvider t,CancellationToken ct){if(!Guid.TryParse(u.FindFirst("sub")?.Value,out var id))return Results.Unauthorized();var p=await r.FirstOrDefaultAsync(x=>x.AuthIdentityId==id&&x.BusinessId==t.BusinessId,ct);if(p is null)return Results.NotFound();p.FirstName=input.FirstName;p.LastName=input.LastName;p.Phone=input.Phone;p.Notes=input.Notes;p.ConsentMarketing=input.ConsentMarketing;await r.ReplaceAsync(p,ct);return Results.Ok(p);}
 static async Task<IResult> FindIdentity(ClaimsPrincipal u,IMongoRepository<CustomerProfile> r,ITenantProvider t,CancellationToken ct){if(!Guid.TryParse(u.FindFirst("sub")?.Value,out var id))return Results.Unauthorized();var p=await r.FirstOrDefaultAsync(x=>x.AuthIdentityId==id&&x.BusinessId==t.BusinessId,ct);return p is null?Results.NotFound():Results.Ok(p);}
 static bool IsStaff(ClaimsPrincipal user)=>user.IsInRole("Employee")||user.IsInRole("BusinessAdmin");
}
public sealed class UserAuthenticatedHandler(IMongoRepository<CustomerProfile> r):IIntegrationEventHandler<StudioPlatform.Shared.Contracts.UserAuthenticatedIntegrationEvent>
{
 public async Task HandleAsync(StudioPlatform.Shared.Contracts.UserAuthenticatedIntegrationEvent e,CancellationToken ct)
 {
  var profile=await r.FirstOrDefaultAsync(x=>x.BusinessId==e.BusinessId&&x.Email==e.Email,ct);
  if(profile is null) await r.InsertAsync(new CustomerProfile{Id=Guid.NewGuid(),BusinessId=e.BusinessId,AuthIdentityId=e.UserId,Email=e.Email},ct);
  else { profile.AuthIdentityId=e.UserId; await r.ReplaceAsync(profile,ct); }
 }
}
