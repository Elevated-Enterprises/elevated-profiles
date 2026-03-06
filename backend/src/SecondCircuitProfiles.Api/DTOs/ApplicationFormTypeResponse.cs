namespace SecondCircuitProfiles.Api.DTOs;

public class ApplicationFormTypeResponse
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public List<ApplicationQuestionResponse> Questions { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ApplicationFormTypeSummaryResponse
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
    public int QuestionCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ApplicationQuestionResponse
{
    public string Id { get; set; } = null!;
    public string Text { get; set; } = null!;
    public int SortOrder { get; set; }
}
