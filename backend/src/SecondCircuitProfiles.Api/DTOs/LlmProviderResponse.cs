namespace SecondCircuitProfiles.Api.DTOs;

public class LlmProviderResponse
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
