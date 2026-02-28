namespace SecondCircuitProfiles.Api.DTOs;

public class AvailableEmojiResponse
{
    public string Id { get; set; } = null!;
    public string Key { get; set; } = null!;
    public string Emoji { get; set; } = null!;
    public string Label { get; set; } = null!;
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}
