namespace SecondCircuitProfiles.Api.DTOs;

public class RuleResponse
{
    public string Id { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Summary { get; set; } = null!;
    public string Body { get; set; } = null!;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
