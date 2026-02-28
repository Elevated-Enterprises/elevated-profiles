using System.ComponentModel.DataAnnotations;

namespace SecondCircuitProfiles.Api.DTOs;

public class CompanionReorderRequest
{
    [Required]
    public List<string> CompanionIds { get; set; } = [];
}
