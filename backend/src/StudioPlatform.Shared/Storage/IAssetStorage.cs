namespace StudioPlatform.Shared.Storage;

public interface IAssetStorage
{
    Task<string> UploadAsync(
        Stream stream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default);
}
