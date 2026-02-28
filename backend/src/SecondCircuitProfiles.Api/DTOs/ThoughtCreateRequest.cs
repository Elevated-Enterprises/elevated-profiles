namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtCreateRequest
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public List<string>? Tags { get; set; }
}
