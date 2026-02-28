using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("discordId")]
    public string DiscordId { get; set; } = null!;

    [BsonElement("discordUsername")]
    public string DiscordUsername { get; set; } = null!;

    [BsonElement("slug")]
    public string Slug { get; set; } = null!;

    [BsonElement("visibility")]
    public Visibility Visibility { get; set; } = Visibility.Private;

    [BsonElement("locationVisibility")]
    public Visibility LocationVisibility { get; set; } = Visibility.MembersOnly;

    [BsonElement("dateOfBirthVisibility")]
    public Visibility DateOfBirthVisibility { get; set; } = Visibility.MembersOnly;

    [BsonElement("profileImageFilename")]
    public string? ProfileImageFilename { get; set; }

    [BsonElement("bannerImageFilename")]
    public string? BannerImageFilename { get; set; }

    [BsonElement("timezoneOffsetMinutes")]
    public int? TimezoneOffsetMinutes { get; set; }

    [BsonElement("languages")]
    public List<string> Languages { get; set; } = [];

    [BsonElement("alternativeName")]
    public string? AlternativeName { get; set; }

    [BsonElement("dateOfBirth")]
    public DateTime? DateOfBirth { get; set; }

    [BsonElement("country")]
    public string? Country { get; set; }

    [BsonElement("city")]
    public string? City { get; set; }

    [BsonElement("bio")]
    public string? Bio { get; set; }

    [BsonElement("alignment")]
    public Alignment? Alignment { get; set; }

    [BsonElement("isAdmin")]
    public bool IsAdmin { get; set; }

    [BsonElement("skillIds")]
    public List<string> SkillIds { get; set; } = [];

    [BsonElement("llmExperiences")]
    public List<LlmExperience> LlmExperiences { get; set; } = [];

    [BsonElement("settings")]
    public Dictionary<string, string> Settings { get; set; } = [];

    [BsonElement("links")]
    public List<UserLink> Links { get; set; } = [];

    [BsonElement("primaryCompanionId")]
    public string? PrimaryCompanionId { get; set; }

    [BsonElement("communityRoleIds")]
    public List<string> CommunityRoleIds { get; set; } = [];

    [BsonElement("ambassadorCommunityId")]
    public string? AmbassadorCommunityId { get; set; }

    [BsonElement("isBlocked")]
    public bool IsBlocked { get; set; }

    [BsonElement("joinedAt")]
    public DateTime? JoinedAt { get; set; }

    [BsonElement("profileUpdatedAt")]
    public DateTime? ProfileUpdatedAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
