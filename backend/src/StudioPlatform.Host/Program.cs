using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;
using StackExchange.Redis;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using StudioPlatform.Shared.Infrastructure;
using StudioPlatform.Shared.Modules;
using StudioPlatform.Shared.Tenancy;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);
try
{
    BsonSerializer.RegisterSerializer(new GuidSerializer(MongoDB.Bson.GuidRepresentation.Standard));
}
catch (BsonSerializationException)
{
    // GuidSerializer already registered in process
}

builder.Services.AddSharedInfrastructure(builder.Configuration);
var modules = builder.Services.RegisterDiscoveredModules(
    builder.Configuration,
    typeof(Program).Assembly);
builder.Services.AddEndpointsApiExplorer();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSwaggerGen();
const string CorsPolicyName = "FrontendCorsPolicy";
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
var allowedOrigins = new HashSet<string>(configuredOrigins, StringComparer.OrdinalIgnoreCase)
{
    "http://localhost:5173",
    "http://localhost:3000"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        policy.WithOrigins(allowedOrigins.ToArray())
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret must be configured.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("DeveloperOnly", policy =>
        policy.RequireAssertion(context =>
            context.User.IsInRole("Developer")));
    options.AddPolicy("BusinessManager", policy =>
        policy.RequireAssertion(context =>
            context.User.IsInRole("Developer") || context.User.IsInRole("BusinessAdmin")));
});
if (builder.Environment.IsDevelopment())
    builder.Services.AddHostedService<DemoDataSeeder>();

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "uploads"));
app.UseStaticFiles(new StaticFileOptions
{
    RequestPath = "/uploads",
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(app.Environment.ContentRootPath, "uploads"))
});
app.UseCors(CorsPolicyName);
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseHttpsRedirection();
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", async (
    IMongoClient mongoClient,
    IConnectionMultiplexer redis,
    CancellationToken cancellationToken) =>
{
    try
    {
        await mongoClient
            .GetDatabase("admin")
            .RunCommandAsync<BsonDocument>(
                new BsonDocument("ping", 1),
                cancellationToken: cancellationToken);
        await redis.GetDatabase().PingAsync();

        return Results.Ok(new { status = "Healthy", mongo = "Healthy", redis = "Healthy" });
    }
    catch (Exception exception) when (exception is MongoException or RedisException)
    {
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
})
.WithName("Health")
.WithTags("Health");

app.MapModuleEndpoints(modules);

app.Run();

public partial class Program;
