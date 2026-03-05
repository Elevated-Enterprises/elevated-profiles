namespace SecondCircuitProfiles.Api.Models;

public record ArticleMetadata(
    string Title,
    string Description,
    string Author,
    string[] Tags,
    DateOnly? DateCreated,
    DateOnly? DateUpdated,
    bool Featured,
    string Status
);

public record ArticleIndexEntry(
    string Path,         // e.g. "ethics/intro-to-ai-ethics"
    string Category,     // e.g. "ethics"
    string Slug,         // e.g. "intro-to-ai-ethics"
    ArticleMetadata Metadata
);

public record AcademyCategory(
    string Slug,
    string DisplayName,
    int ArticleCount
);

public record AcademyIndex(
    ArticleIndexEntry? FeaturedArticle,
    ArticleIndexEntry[] RecentArticles,
    AcademyCategory[] Categories,
    DateTime? LastSyncedAt,
    int TotalArticles
);

public record ArticleResponse(
    string Path,
    ArticleMetadata Metadata,
    string Markdown    // raw markdown with frontmatter stripped
);

public record SyncResult(
    bool Success,
    string? Error,
    int ArticleCount,
    DateTime SyncedAt
);
