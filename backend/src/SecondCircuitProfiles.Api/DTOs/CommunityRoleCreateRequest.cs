using System.ComponentModel.DataAnnotations;

namespace SecondCircuitProfiles.Api.DTOs;

public class CommunityRoleCreateRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = null!;
}
