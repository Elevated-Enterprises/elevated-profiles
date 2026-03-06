namespace SecondCircuitProfiles.Api.DTOs;

public class ProfileInsightsResponse
{
    public List<ProfileVisitorEntry> Visitors { get; set; } = [];
    public List<ReactionGroupWithReactors> ReactionGroups { get; set; } = [];
}

public class ProfileVisitorEntry
{
    public string Slug { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string? AvatarUrl { get; set; }
    public DateTime VisitedAt { get; set; }
}
