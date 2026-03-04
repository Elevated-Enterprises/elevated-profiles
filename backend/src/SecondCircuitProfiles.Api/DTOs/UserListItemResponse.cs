using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class UserListItemResponse
{
    public string Slug { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string? ProfileImageUrl { get; set; }
    public List<string> CompanionNames { get; set; } = [];
    public Alignment? Alignment { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsBlocked { get; set; }
    public bool HasCommunityRoles { get; set; }
    public string? PrimaryCompanionName { get; set; }
    public bool IsAmbassador { get; set; }
    public string? AmbassadorCommunityName { get; set; }
    public string? Status { get; set; }
    public bool IsOnline { get; set; }
}
