namespace SecondCircuitProfiles.Api.DTOs;

public class CreateApplicationFormTypeRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public List<ApplicationQuestionRequest> Questions { get; set; } = [];
}

public class ApplicationQuestionRequest
{
    public string Text { get; set; } = null!;
    public int SortOrder { get; set; }
}
