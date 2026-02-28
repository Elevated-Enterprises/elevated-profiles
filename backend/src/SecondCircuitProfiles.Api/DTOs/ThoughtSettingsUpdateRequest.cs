namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtSettingsUpdateRequest
{
    public int? MaxThoughtsPerWindow { get; set; }
    public int? RateLimitWindowHours { get; set; }
    public int? MinThoughtLength { get; set; }
    public int? MinCommentLength { get; set; }
}
