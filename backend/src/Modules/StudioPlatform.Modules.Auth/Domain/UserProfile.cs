using StudioPlatform.Shared.Persistence;

namespace StudioPlatform.Modules.Auth;

public sealed class UserProfile : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public AddressProfile Address { get; set; } = new();
    public bool OnboardingCompleted { get; set; }
}

public sealed class AddressProfile
{
    public string? Line1 { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; }
}
