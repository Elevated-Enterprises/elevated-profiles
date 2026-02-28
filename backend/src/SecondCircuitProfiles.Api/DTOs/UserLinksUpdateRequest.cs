using System.ComponentModel.DataAnnotations;

namespace SecondCircuitProfiles.Api.DTOs;

public class UserLinksUpdateRequest
{
    public List<UserLinkItem> Links { get; set; } = [];
}

public class UserLinkItem
{
    [Required]
    [MaxLength(100)]
    public string Label { get; set; } = null!;

    [Required]
    [MaxLength(500)]
    public string Url { get; set; } = null!;
}
