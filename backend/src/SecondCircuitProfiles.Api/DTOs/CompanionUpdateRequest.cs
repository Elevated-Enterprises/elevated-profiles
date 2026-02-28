using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class CompanionUpdateRequest
{
    public Visibility? Visibility { get; set; }
    public string? Name { get; set; }
    public string? Platform { get; set; }
    public string? Role { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Bio { get; set; }
    public Alignment? Alignment { get; set; }
    /// <summary>Set to true to explicitly clear the alignment field.</summary>
    public bool ClearAlignment { get; set; }
}
