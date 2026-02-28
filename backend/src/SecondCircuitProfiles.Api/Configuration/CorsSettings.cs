namespace SecondCircuitProfiles.Api.Configuration;

public class CorsSettings
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; set; } = ["http://localhost:3000"];
}
