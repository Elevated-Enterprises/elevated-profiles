namespace SecondCircuitProfiles.Api.DTOs;

public class PartnerCommunityResponse
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string DiscordInviteUrl { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
