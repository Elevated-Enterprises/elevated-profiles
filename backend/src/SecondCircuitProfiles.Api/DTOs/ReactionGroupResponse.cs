namespace SecondCircuitProfiles.Api.DTOs;

public class ReactionGroupResponse
{
    public string EmojiKey { get; set; } = null!;
    public string Emoji { get; set; } = null!;
    public string Label { get; set; } = null!;
    public int Count { get; set; }
    public bool UserHasReacted { get; set; }
}
