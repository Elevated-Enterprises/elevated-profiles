namespace SecondCircuitProfiles.Api.DTOs;

public class TagResponse
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public int ThoughtCount { get; set; }
}
