namespace SecondCircuitProfiles.Api.DTOs;

public class FeedItemResponse
{
    public string Id { get; set; } = null!;
    public string Type { get; set; } = null!;
    public string ActorSlug { get; set; } = null!;
    public string ActorUsername { get; set; } = null!;
    public string? ActorAvatarUrl { get; set; }
    public string? TargetId { get; set; }
    public string? TargetTitle { get; set; }
    public string? TargetType { get; set; }
    public string? Excerpt { get; set; }
    public DateTime Timestamp { get; set; }
    public bool IsFromFollowed { get; set; }
    public int? ReactionCount { get; set; }
}
