using System.ComponentModel.DataAnnotations;

namespace SecondCircuitProfiles.Api.DTOs;

public class LlmProviderCreateRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;
}
