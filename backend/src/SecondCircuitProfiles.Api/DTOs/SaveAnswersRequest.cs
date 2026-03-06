namespace SecondCircuitProfiles.Api.DTOs;

public class SaveAnswersRequest
{
    public List<ApplicationAnswerRequest> Answers { get; set; } = [];
}

public class ApplicationAnswerRequest
{
    public string QuestionId { get; set; } = null!;
    public string Text { get; set; } = "";
}
