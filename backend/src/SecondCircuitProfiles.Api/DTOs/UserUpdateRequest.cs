using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.DTOs;

public class UserUpdateRequest
{
    public Visibility? Visibility { get; set; }
    public Visibility? LocationVisibility { get; set; }
    public Visibility? DateOfBirthVisibility { get; set; }
    public string? AlternativeName { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Country { get; set; }
    public string? City { get; set; }
    public string? Bio { get; set; }
    public Alignment? Alignment { get; set; }
    /// <summary>Set to true to explicitly clear the alignment field.</summary>
    public bool ClearAlignment { get; set; }
    public int? TimezoneOffsetMinutes { get; set; }
    /// <summary>Set to true to explicitly clear the timezone field.</summary>
    public bool ClearTimezone { get; set; }
}
