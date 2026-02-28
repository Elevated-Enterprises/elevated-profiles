namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtRateLimitResponse
{
    public int MaxPerWindow { get; set; }
    public int WindowHours { get; set; }
    public int UsedInWindow { get; set; }
    public int RemainingInWindow { get; set; }
}
