using Microsoft.Extensions.Logging;
using StudioPlatform.Shared.Caching;

namespace StudioPlatform.Shared.Email;

public sealed class ConsoleDevelopmentEmailSender(
    ILogger<ConsoleDevelopmentEmailSender> logger,
    IRedisCacheService cache) : IEmailSender
{
    public async Task SendOtpAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Passwordless OTP for {Email}: {Code}", email, code);
        await cache.SetAsync($"auth:otp:dev:{email.ToLowerInvariant()}", code, TimeSpan.FromMinutes(10));
    }

    public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "--- DEVELOPMENT EMAIL SIMULATION ---\nTo: {To}\nSubject: {Subject}\nBody:\n{HtmlBody}\n-----------------------------------",
            to, subject, htmlBody);
        return Task.CompletedTask;
    }
}
