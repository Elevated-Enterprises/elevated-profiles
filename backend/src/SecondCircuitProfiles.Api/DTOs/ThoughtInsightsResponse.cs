namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtInsightsResponse
{
    public List<ThoughtReaderEntry> Readers { get; set; } = [];
    public List<ReactionGroupWithReactors> ReactionGroups { get; set; } = [];
}

public class ThoughtReaderEntry
{
    public string Slug { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string? AvatarUrl { get; set; }
    public DateTime ReadAt { get; set; }
}

public class ReactionGroupWithReactors
{
    public string EmojiKey { get; set; } = null!;
    public string Emoji { get; set; } = null!;
    public string Label { get; set; } = null!;
    public List<ReactionReactorEntry> Reactors { get; set; } = [];
}

public class ReactionReactorEntry
{
    public string Slug { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string? AvatarUrl { get; set; }
}
