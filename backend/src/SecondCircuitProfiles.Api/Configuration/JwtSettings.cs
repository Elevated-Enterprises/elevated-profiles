namespace SecondCircuitProfiles.Api.Configuration;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "SecondCircuitProfiles";
    public string Audience { get; set; } = "SecondCircuitProfiles";
    public int ExpirationMinutes { get; set; } = 1440;
}
