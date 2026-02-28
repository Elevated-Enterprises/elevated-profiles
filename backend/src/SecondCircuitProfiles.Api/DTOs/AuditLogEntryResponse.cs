namespace SecondCircuitProfiles.Api.DTOs;

public class AuditLogEntryResponse
{
    public string Id { get; set; } = null!;
    public string AdminDiscordId { get; set; } = null!;
    public string AdminDiscordUsername { get; set; } = null!;
    public string Action { get; set; } = null!;
    public string TargetType { get; set; } = null!;
    public string TargetId { get; set; } = null!;
    public string? Details { get; set; }
    public object? PreviousValues { get; set; }
    public object? NewValues { get; set; }
    public DateTime Timestamp { get; set; }
}
