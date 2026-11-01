using System.Reflection;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StudioPlatform.Shared.Modules;

public static class ModuleDiscoveryExtensions
{
    public static IReadOnlyList<IModule> RegisterDiscoveredModules(
        this IServiceCollection services,
        IConfiguration configuration,
        Assembly entryAssembly)
    {
        var modules = Discover(entryAssembly);

        foreach (var module in modules)
        {
            module.RegisterModule(services, configuration);
        }

        return modules;
    }

    public static void MapModuleEndpoints(
        this IEndpointRouteBuilder endpoints,
        IEnumerable<IModule> modules)
    {
        foreach (var module in modules)
        {
            module.MapEndpoints(endpoints);
        }
    }

    private static IReadOnlyList<IModule> Discover(Assembly entryAssembly)
    {
        var assemblies = new[] { entryAssembly }
            .Concat(entryAssembly
                .GetReferencedAssemblies()
                .Where(reference => reference.Name?.StartsWith("StudioPlatform.", StringComparison.Ordinal) == true)
                .Select(Assembly.Load))
            .Concat(AppDomain.CurrentDomain
                .GetAssemblies()
                .Where(assembly => assembly.GetName().Name?.StartsWith(
                    "StudioPlatform.",
                    StringComparison.Ordinal) == true))
            .Concat(Directory
                .EnumerateFiles(AppContext.BaseDirectory, "StudioPlatform.*.dll")
                .Select(Assembly.LoadFrom))
            .Distinct()
            .ToArray();

        return assemblies
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type =>
                typeof(IModule).IsAssignableFrom(type) &&
                type is { IsAbstract: false, IsInterface: false })
            .Select(type => (IModule)Activator.CreateInstance(type)!)
            .ToArray();
    }
}
