using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace StudioPlatform.Shared.Storage;

public sealed class S3AssetStorage(
    HttpClient httpClient,
    IOptions<S3StorageOptions> options,
    ILogger<S3AssetStorage> logger) : IAssetStorage
{
    private readonly S3StorageOptions _options = options.Value;

    public async Task<string> UploadAsync(
        Stream stream,
        string fileName,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var bucket = _options.BucketName ?? throw new InvalidOperationException("S3 BucketName is required.");
        var region = string.IsNullOrWhiteSpace(_options.Region) ? "us-east-1" : _options.Region;

        using var memoryStream = new MemoryStream();
        await stream.CopyToAsync(memoryStream, cancellationToken);
        var bytes = memoryStream.ToArray();

        string uploadUrl;
        if (!string.IsNullOrWhiteSpace(_options.ServiceUrl))
        {
            var baseUrl = _options.ServiceUrl.TrimEnd('/');
            uploadUrl = $"{baseUrl}/{bucket}/{fileName}";
        }
        else
        {
            uploadUrl = $"https://{bucket}.s3.{region}.amazonaws.com/{fileName}";
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, uploadUrl)
        {
            Content = new ByteArrayContent(bytes)
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

        if (!string.IsNullOrWhiteSpace(_options.AccessKey) && !string.IsNullOrWhiteSpace(_options.SecretKey))
        {
            SignRequest(request, bytes, region, "s3", _options.AccessKey, _options.SecretKey);
        }

        var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        logger.LogInformation("Successfully uploaded {FileName} to S3 bucket {Bucket}", fileName, bucket);

        if (!string.IsNullOrWhiteSpace(_options.CdnUrl))
        {
            return $"{_options.CdnUrl.TrimEnd('/')}/{fileName}";
        }

        return uploadUrl;
    }

    private static void SignRequest(
        HttpRequestMessage request,
        byte[] payload,
        string region,
        string service,
        string accessKey,
        string secretKey)
    {
        var now = DateTimeOffset.UtcNow;
        var amzDate = now.ToString("yyyyMMddTHHmmssZ");
        var dateStamp = now.ToString("yyyyMMdd");

        request.Headers.Add("x-amz-date", amzDate);
        var payloadHash = Convert.ToHexString(SHA256.HashData(payload)).ToLowerInvariant();
        request.Headers.Add("x-amz-content-sha256", payloadHash);

        var host = request.RequestUri!.Host;
        var canonicalUri = request.RequestUri.AbsolutePath;
        var canonicalHeaders = $"host:{host}\nx-amz-content-sha256:{payloadHash}\nx-amz-date:{amzDate}\n";
        var signedHeaders = "host;x-amz-content-sha256;x-amz-date";

        var canonicalRequest = $"PUT\n{canonicalUri}\n\n{canonicalHeaders}\n{signedHeaders}\n{payloadHash}";
        var scope = $"{dateStamp}/{region}/{service}/aws4_request";
        var stringToSign = $"AWS4-HMAC-SHA256\n{amzDate}\n{scope}\n{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonicalRequest))).ToLowerInvariant()}";

        var kDate = HmacSha256(Encoding.UTF8.GetBytes("AWS4" + secretKey), dateStamp);
        var kRegion = HmacSha256(kDate, region);
        var kService = HmacSha256(kRegion, service);
        var kSigning = HmacSha256(kService, "aws4_request");
        var signature = Convert.ToHexString(HmacSha256(kSigning, stringToSign)).ToLowerInvariant();

        var authHeader = $"AWS4-HMAC-SHA256 Credential={accessKey}/{scope}, SignedHeaders={signedHeaders}, Signature={signature}";
        request.Headers.TryAddWithoutValidation("Authorization", authHeader);
    }

    private static byte[] HmacSha256(byte[] key, string data)
    {
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
    }
}
