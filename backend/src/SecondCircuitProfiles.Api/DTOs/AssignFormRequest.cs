namespace SecondCircuitProfiles.Api.DTOs;

public class AssignFormRequest
{
    public string FormTypeId { get; set; } = null!;
    public string UserSlug { get; set; } = null!;
    public bool LockedOut { get; set; }
}
