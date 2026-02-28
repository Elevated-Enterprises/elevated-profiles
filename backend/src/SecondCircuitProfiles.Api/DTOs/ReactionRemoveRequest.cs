namespace SecondCircuitProfiles.Api.DTOs;

public class ReactionRemoveRequest
{
    public string TargetId { get; set; } = null!;
    public string TargetType { get; set; } = null!;
    public string EmojiKey { get; set; } = null!;
}
