using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class CompanionCreateRequest
{
    public Visibility Visibility { get; set; } = Visibility.Private;
    public string Name { get; set; } = null!;
    public string? Platform { get; set; }
    public string? Role { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Bio { get; set; }
    public Alignment? Alignment { get; set; }
}
