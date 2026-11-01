using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace StudioPlatform.Shared.Email;

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    public async Task SendOtpAsync(string email, string code, CancellationToken cancellationToken = default)
    {
        await SendEmailAsync(
            email,
            "Your StudioPlatform login code",
            $"<p>Your one-time login code is <strong>{code}</strong>. It expires in 10 minutes.</p>",
            cancellationToken);
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var host = configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            throw new InvalidOperationException("Smtp:Host must be configured to send email via SMTP.");
        }

        using var client = new SmtpClient(host)
        {
            Port = configuration.GetValue("Smtp:Port", 587),
            EnableSsl = true,
            Credentials = new NetworkCredential(
                configuration["Smtp:Username"],
                configuration["Smtp:Password"])
        };

        var from = configuration["Smtp:From"]
            ?? throw new InvalidOperationException("Smtp:From is required.");

        using var message = new MailMessage(from, to, subject, htmlBody)
        {
            IsBodyHtml = true
        };

        await client.SendMailAsync(message, cancellationToken);
    }
}
