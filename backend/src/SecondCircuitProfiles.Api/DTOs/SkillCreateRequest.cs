using System.ComponentModel.DataAnnotations;

namespace SecondCircuitProfiles.Api.DTOs;

public class SkillCreateRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;
}
