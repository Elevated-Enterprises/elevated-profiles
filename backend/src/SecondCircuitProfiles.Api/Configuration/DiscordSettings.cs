namespace SecondCircuitProfiles.Api.Configuration;

public class DiscordSettings
{
    public const string SectionName = "Discord";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string GuildId { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string? RedirectUriOverride { get; set; }
}
