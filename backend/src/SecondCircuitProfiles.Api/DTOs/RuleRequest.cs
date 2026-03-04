namespace SecondCircuitProfiles.Api.DTOs;

public class RuleRequest
{
    public string Title { get; set; } = null!;
    public string Summary { get; set; } = null!;
    public string Body { get; set; } = null!;
}

public class RuleReorderRequest
{
    public List<string> RuleIds { get; set; } = [];
}
