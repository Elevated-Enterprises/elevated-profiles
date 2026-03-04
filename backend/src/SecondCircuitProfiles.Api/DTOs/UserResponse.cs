using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class UserResponse
{
    public string Slug { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string DiscordUsername { get; set; } = null!;
    public Visibility Visibility { get; set; }
    public Visibility LocationVisibility { get; set; }
    public Visibility DateOfBirthVisibility { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public int? TimezoneOffsetMinutes { get; set; }
    public List<string> Languages { get; set; } = [];
    public string? AlternativeName { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? Bio { get; set; }
    public Alignment? Alignment { get; set; }
    public bool IsOwnProfile { get; set; }
    public bool IsAdmin { get; set; }
    public List<SkillResponse> Skills { get; set; } = [];
    public List<LlmExperienceResponse> LlmExperiences { get; set; } = [];
    public List<CompanionResponse> Companions { get; set; } = [];
    public List<UserLinkResponse> Links { get; set; } = [];
    public string? PrimaryCompanionId { get; set; }
    public List<CommunityRoleResponse> CommunityRoles { get; set; } = [];
    public PartnerCommunityResponse? AmbassadorCommunity { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime JoinedAt { get; set; }
    public DateTime? ProfileUpdatedAt { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    // Only populated for the profile owner
    public int? VisitCount { get; set; }
    public int? UniqueVisitorCount { get; set; }
}
