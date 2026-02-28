namespace SecondCircuitProfiles.Api.DTOs;

public class ThoughtUpdateRequest
{
    public string? Title { get; set; }
    public string? Body { get; set; }
    public bool ClearImage { get; set; }
}
