using System.Collections.Concurrent;
using StudioPlatform.Shared.Email;

namespace StudioPlatform.Shared.Tests.Integration.Infrastructure;

public sealed class TestEmailSender : IEmailSender
{
    public ConcurrentDictionary<string, string> OtpCodes { get; } = new();

    public Task SendOtpAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        OtpCodes[email.ToLowerInvariant()] = code;
        return Task.CompletedTask;
    }

    public Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}

