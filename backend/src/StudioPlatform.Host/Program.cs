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

var builder = WebApplication.CreateBuilder(args);
BsonSerializer.RegisterSerializer(new GuidSerializer(MongoDB.Bson.GuidRepresentation.Standard));

builder.Services.AddSharedInfrastructure(builder.Configuration);
var modules = builder.Services.RegisterDiscoveredModules(
    builder.Configuration,
    typeof(Program).Assembly);
builder.Services.AddEndpointsApiExplorer();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSwaggerGen();
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "development-only-secret-change-me-please-32chars";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("DeveloperOnly", policy =>
        policy.RequireAssertion(context =>
            context.User.IsInRole("Developer")));
});
if (builder.Environment.IsDevelopment())
    builder.Services.AddHostedService<DemoDataSeeder>();

var app = builder.Build();

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

app.MapGet("/weatherforecast", () =>
{
    var summaries = new[]
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild",
        "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    return Enumerable.Range(1, 5).Select(index => new WeatherForecast(
        DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
        Random.Shared.Next(-20, 55),
        summaries[Random.Shared.Next(summaries.Length)]));
})
.WithName("GetWeatherForecast");

app.MapModuleEndpoints(modules);

app.Run();

public partial class Program;

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
