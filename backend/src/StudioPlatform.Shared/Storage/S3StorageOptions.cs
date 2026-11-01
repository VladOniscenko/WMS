namespace StudioPlatform.Shared.Storage;

public sealed class S3StorageOptions
{
    public string? BucketName { get; set; }
    public string? Region { get; set; } = "us-east-1";
    public string? AccessKey { get; set; }
    public string? SecretKey { get; set; }
    public string? ServiceUrl { get; set; }
    public string? CdnUrl { get; set; }
}
