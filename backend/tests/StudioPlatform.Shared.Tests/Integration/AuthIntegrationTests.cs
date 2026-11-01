using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace StudioPlatform.Shared.Tests.Integration;

public sealed class AuthIntegrationTests : IClassFixture<StudioPlatformApiFactory>
{
    private readonly StudioPlatformApiFactory _factory;
    private readonly HttpClient _client;

    public AuthIntegrationTests(StudioPlatformApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RequestOtp_ReturnsOk_AndSendsCode()
    {
        var email = "customer@studio.test";
        var request = new { Email = email, Scope = "customer" };

        var response = await _client.PostAsJsonAsync("/api/auth/otp/request", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.TryGetProperty("message", out var messageProp));
        Assert.Equal("Code sent.", messageProp.GetString());

        // Verify OTP was stored in TestEmailSender or returned in developmentCode
        Assert.True(_factory.EmailSender.OtpCodes.ContainsKey(email) || json.TryGetProperty("developmentCode", out _));
    }

    [Fact]
    public async Task VerifyOtp_ValidCode_ReturnsJwtAndRefreshToken()
    {
        var email = "verify-user@studio.test";

        // 1. Request OTP
        var reqResponse = await _client.PostAsJsonAsync("/api/auth/request-code", new { Email = email, Scope = "customer" });
        Assert.Equal(HttpStatusCode.OK, reqResponse.StatusCode);
        var reqJson = await reqResponse.Content.ReadFromJsonAsync<JsonElement>();
        var code = reqJson.TryGetProperty("developmentCode", out var devCode)
            ? devCode.GetString()!
            : _factory.EmailSender.OtpCodes[email];

        // 2. Verify OTP
        var verifyResponse = await _client.PostAsJsonAsync("/api/auth/otp/verify", new { Email = email, Code = code });
        Assert.Equal(HttpStatusCode.OK, verifyResponse.StatusCode);

        var verifyJson = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(verifyJson.TryGetProperty("accessToken", out var accessTokenProp));
        Assert.False(string.IsNullOrWhiteSpace(accessTokenProp.GetString()));

        Assert.True(verifyJson.TryGetProperty("refreshToken", out var refreshTokenProp));
        Assert.False(string.IsNullOrWhiteSpace(refreshTokenProp.GetString()));

        Assert.True(verifyJson.TryGetProperty("user", out var userProp));
        Assert.Equal(email, userProp.GetProperty("email").GetString());
    }

    [Fact]
    public async Task VerifyOtp_InvalidCode_ReturnsBadRequest()
    {
        var email = "invalid-user@studio.test";

        await _client.PostAsJsonAsync("/api/auth/otp/request", new { Email = email, Scope = "customer" });

        var verifyResponse = await _client.PostAsJsonAsync("/api/auth/otp/verify", new { Email = email, Code = "000000" });
        Assert.Equal(HttpStatusCode.BadRequest, verifyResponse.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_ValidToken_RotatesTokenAndInvalidatesOldToken()
    {
        var email = "refresh-user@studio.test";

        // 1. Request & Verify to get initial tokens
        var reqResponse = await _client.PostAsJsonAsync("/api/auth/request-code", new { Email = email, Scope = "customer" });
        var reqJson = await reqResponse.Content.ReadFromJsonAsync<JsonElement>();
        var code = reqJson.TryGetProperty("developmentCode", out var devCode)
            ? devCode.GetString()!
            : _factory.EmailSender.OtpCodes[email];

        var verifyResponse = await _client.PostAsJsonAsync("/api/auth/verify-code", new { Email = email, Code = code });
        var verifyJson = await verifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        var firstRefreshToken = verifyJson.GetProperty("refreshToken").GetString();
        Assert.NotNull(firstRefreshToken);

        // 2. Refresh token rotation
        var refreshResponse = await _client.PostAsJsonAsync("/api/auth/refresh", new { RefreshToken = firstRefreshToken });
        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);

        var refreshJson = await refreshResponse.Content.ReadFromJsonAsync<JsonElement>();
        var secondRefreshToken = refreshJson.GetProperty("refreshToken").GetString();
        Assert.NotNull(secondRefreshToken);
        Assert.NotEqual(firstRefreshToken, secondRefreshToken);

        // 3. Attempt to reuse the first (revoked) refresh token -> must be 401 Unauthorized
        var staleResponse = await _client.PostAsJsonAsync("/api/auth/refresh", new { RefreshToken = firstRefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, staleResponse.StatusCode);
    }
}

