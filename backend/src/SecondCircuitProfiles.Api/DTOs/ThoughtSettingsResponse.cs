using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtSettingsResponse
{
    public int MaxThoughtsPerWindow { get; set; }
    public int RateLimitWindowHours { get; set; }
    public int MinThoughtLength { get; set; }
    public int MinCommentLength { get; set; }
    public Dictionary<string, ThoughtSettingsOverride> UserOverrides { get; set; } = new();
}
