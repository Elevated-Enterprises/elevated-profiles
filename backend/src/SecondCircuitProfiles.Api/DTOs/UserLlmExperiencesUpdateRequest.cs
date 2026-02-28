using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class UserLlmExperiencesUpdateRequest
{
    public List<LlmExperienceItem> Experiences { get; set; } = [];
}

public class LlmExperienceItem
{
    public string LlmProviderId { get; set; } = null!;
    public ExperienceLevel ExperienceLevel { get; set; } = ExperienceLevel.NoExperience;
}
