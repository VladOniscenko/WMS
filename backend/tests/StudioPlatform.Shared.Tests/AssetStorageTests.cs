using System.Text;
using Microsoft.AspNetCore.Hosting;
using StudioPlatform.Shared.Storage;
using Xunit;

namespace StudioPlatform.Shared.Tests;

public sealed class AssetStorageTests
{
    [Fact]
    public async Task LocalAssetStorage_UploadsStream_AndReturnsRelativePath()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "wms_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            var env = new TestWebHostEnvironment { ContentRootPath = tempDir };
            var storage = new LocalAssetStorage(env);

            var content = "test image binary content";
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
            var fileName = "photo.jpg";

            var url = await storage.UploadAsync(stream, fileName, "image/jpeg");

            Assert.Equal("/uploads/photo.jpg", url);
            var savedPath = Path.Combine(tempDir, "uploads", fileName);
            Assert.True(File.Exists(savedPath));
            var savedContent = await File.ReadAllTextAsync(savedPath);
            Assert.Equal(content, savedContent);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, true);
            }
        }
    }

    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ApplicationName { get; set; } = "Test";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Testing";
    }
}
