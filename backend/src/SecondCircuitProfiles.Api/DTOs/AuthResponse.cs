namespace SecondCircuitProfiles.Api.DTOs;

public class AuthResponse
{
    public string Token { get; set; } = null!;
    public UserResponse User { get; set; } = null!;
}
