namespace StudioPlatform.Shared.Email;

public interface IEmailSender
{
    Task SendOtpAsync(string email, string code, CancellationToken cancellationToken = default);

    Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default);
}
