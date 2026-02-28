using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class LlmExperienceResponse
{
    public string LlmProviderId { get; set; } = null!;
    public string LlmProviderName { get; set; } = null!;
    public ExperienceLevel ExperienceLevel { get; set; }
}
