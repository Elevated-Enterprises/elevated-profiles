namespace SecondCircuitProfiles.Api.DTOs;

public class ApplicationSubmissionHistoryResponse
{
    public string Id { get; set; } = null!;
    public string? FromState { get; set; }
    public string ToState { get; set; } = null!;
    public string ChangedByDiscordUsername { get; set; } = null!;
    public string? Remarks { get; set; }
    public DateTime ChangedAt { get; set; }
}
