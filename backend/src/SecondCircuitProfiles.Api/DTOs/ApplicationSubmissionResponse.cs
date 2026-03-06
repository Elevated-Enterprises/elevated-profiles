namespace SecondCircuitProfiles.Api.DTOs;

public class ApplicationSubmissionResponse
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string FormTypeId { get; set; } = null!;
    public string FormTypeName { get; set; } = null!;
    public string? FormTypeDescription { get; set; }
    public List<ApplicationQuestionResponse> Questions { get; set; } = [];
    public string State { get; set; } = null!;
    public List<ApplicationAnswerResponse> Answers { get; set; } = [];
    public string? AdminRemarks { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReviewStartedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    // Populated for admin endpoints
    public string? UserDisplayName { get; set; }
    public string? UserSlug { get; set; }
    public string? UserDiscordUsername { get; set; }
    public List<ApplicationSubmissionHistoryResponse>? History { get; set; }
}

public class ApplicationAnswerResponse
{
    public string QuestionId { get; set; } = null!;
    public string Text { get; set; } = null!;
}

public class ApplicationSubmissionSummaryResponse
{
    public string Id { get; set; } = null!;
    public string FormTypeId { get; set; } = null!;
    public string FormTypeName { get; set; } = null!;
    public string State { get; set; } = null!;
    public string? AdminRemarks { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    // Admin view
    public string? UserDisplayName { get; set; }
    public string? UserSlug { get; set; }
    public string? UserDiscordUsername { get; set; }
}

public class AvailableFormResponse
{
    public ApplicationFormTypeSummaryResponse FormType { get; set; } = null!;
    public ApplicationSubmissionSummaryResponse? MySubmission { get; set; }
}
