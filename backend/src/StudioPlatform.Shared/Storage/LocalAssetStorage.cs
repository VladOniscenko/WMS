using Microsoft.AspNetCore.Hosting;

namespace StudioPlatform.Shared.Storage;

public sealed class LocalAssetStorage(IWebHostEnvironment environment) : IAssetStorage
{
    public async Task<string> UploadAsync(
        Stream stream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var root = Path.Combine(environment.ContentRootPath, "uploads");
        Directory.CreateDirectory(root);
        var filePath = Path.Combine(root, fileName);
        await using var fileStream = File.Create(filePath);
        await stream.CopyToAsync(fileStream, cancellationToken);
        return $"/uploads/{fileName}";
    }
}
