namespace SecondCircuitProfiles.Api.DTOs;

public class AvailableEmojiCreateRequest
{
    public string Key { get; set; } = null!;
    public string Emoji { get; set; } = null!;
    public string Label { get; set; } = null!;
    public int SortOrder { get; set; } = 0;
}
