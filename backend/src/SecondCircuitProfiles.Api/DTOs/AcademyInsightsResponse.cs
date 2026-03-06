namespace SecondCircuitProfiles.Api.DTOs;

public class AcademyArticleInsightsResponse
{
    public int TotalReads { get; set; }
    public int UniqueReaders { get; set; }
    public List<AcademyReaderEntry> Readers { get; set; } = [];
    public List<ReactionGroupWithReactors> ReactionGroups { get; set; } = [];
}

public class AcademyReaderEntry
{
    public string Slug { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string? AvatarUrl { get; set; }
    public DateTime ReadAt { get; set; }
}

public class AcademyReadExportEntry
{
    public string Username { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public DateTime ReadAt { get; set; }
}
