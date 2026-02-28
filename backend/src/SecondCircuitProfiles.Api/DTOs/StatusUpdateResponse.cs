namespace SecondCircuitProfiles.Api.DTOs;

public class StatusUpdateResponse
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Text { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
