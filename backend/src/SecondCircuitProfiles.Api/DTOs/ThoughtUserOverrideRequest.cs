namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtUserOverrideRequest
{
    public int? MaxThoughtsPerWindow { get; set; }
    public int? RateLimitWindowHours { get; set; }
    public int? MinThoughtLength { get; set; }
    public int? MinCommentLength { get; set; }
    public bool Reset { get; set; } = false;
}
