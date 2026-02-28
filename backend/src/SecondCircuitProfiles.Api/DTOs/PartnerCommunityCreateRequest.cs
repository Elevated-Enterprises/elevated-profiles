using System.ComponentModel.DataAnnotations;

namespace SecondCircuitProfiles.Api.DTOs;

public class PartnerCommunityCreateRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(300)]
    public string DiscordInviteUrl { get; set; } = null!;
}
