namespace SecondCircuitProfiles.Api.Configuration;

public class AcademySettings
{
    public const string SectionName = "Academy";

    public string RepoUrl { get; set; } = string.Empty;
    public string ClonePath { get; set; } = "./academy-content";
    public int NewArticleDays { get; set; } = 30;
}
