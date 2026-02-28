namespace SecondCircuitProfiles.Api.DTOs;

public class AuthConfigResponse
{
    public string ClientId { get; set; } = null!;
    public string RedirectUri { get; set; } = null!;
    public string AuthorizationUrl { get; set; } = null!;
}
