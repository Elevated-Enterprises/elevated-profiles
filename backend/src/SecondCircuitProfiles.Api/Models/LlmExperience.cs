using MongoDB.Bson.Serialization.Attributes;

namespace SecondCircuitProfiles.Api.Models;

public class LlmExperience
{
    [BsonElement("llmProviderId")]
    public string LlmProviderId { get; set; } = null!;

    [BsonElement("experienceLevel")]
    public ExperienceLevel ExperienceLevel { get; set; } = ExperienceLevel.NoExperience;
}
