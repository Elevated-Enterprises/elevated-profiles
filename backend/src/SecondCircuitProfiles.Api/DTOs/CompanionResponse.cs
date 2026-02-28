using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class CompanionResponse
{
    public string Id { get; set; } = null!;
    public Visibility Visibility { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string Name { get; set; } = null!;
    public string? Platform { get; set; }
    public string? Role { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Bio { get; set; }
    public Alignment? Alignment { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
