using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.Configuration;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace SecondCircuitProfiles.Api.Services;

public interface IAcademyService
{
    Task<SyncResult> Sync();
    AcademyIndex GetIndex();
    ArticleResponse? GetArticle(string path);
    string? GetImagePath(string relativePath);
    Task TrackArticleRead(string articlePath, string visitorUserId);
    Task<AcademyArticleInsightsResponse> GetArticleInsights(string articlePath);
    Task<List<AcademyReadExportEntry>> GetArticleReadExport(string articlePath, DateTime? from, DateTime? to);
}

public class AcademyService(IOptions<AcademySettings> options, ILogger<AcademyService> logger, MongoDbContext db)
    : IAcademyService
{
    private readonly AcademySettings _settings = options.Value;
    private volatile AcademyIndex _index = new(null, [], [], null, 0);
    private static readonly Regex FrontmatterRegex = new(
        @"^---\s*\n(.*?)\n---\s*\n?(.*)",
        RegexOptions.Singleline | RegexOptions.Compiled);
    private readonly IDeserializer _yaml = new DeserializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    // ── Sync ────────────────────────────────────────────────────────────────

    public async Task<SyncResult> Sync()
    {
        var clonePath = _settings.ClonePath;

        if (string.IsNullOrWhiteSpace(_settings.RepoUrl))
            return new SyncResult(false, "Academy__RepoUrl is not configured.", 0, DateTime.UtcNow);

        try
        {
            // Delete existing clone
            if (Directory.Exists(clonePath))
                Directory.Delete(clonePath, recursive: true);

            // Clone fresh
            var cloneResult = await RunGit("clone", _settings.RepoUrl, clonePath);
            if (!cloneResult.Success)
                return new SyncResult(false, $"git clone failed: {cloneResult.Error}", 0, DateTime.UtcNow);

            // Parse all markdown files
            var entries = ParseAllArticles(clonePath);
            _index = BuildIndex(entries, DateTime.UtcNow);

            logger.LogInformation("Academy sync complete: {Count} published articles.", _index.TotalArticles);
            return new SyncResult(true, null, _index.TotalArticles, _index.LastSyncedAt!.Value);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Academy sync failed.");
            return new SyncResult(false, ex.Message, 0, DateTime.UtcNow);
        }
    }

    // ── Index & Article access ───────────────────────────────────────────────

    public AcademyIndex GetIndex() => _index;

    public ArticleResponse? GetArticle(string path)
    {
        // path: "ethics/intro-to-ai-ethics"
        var filePath = Path.Combine(_settings.ClonePath, path.Replace('/', Path.DirectorySeparatorChar) + ".md");
        if (!File.Exists(filePath)) return null;

        var raw = File.ReadAllText(filePath);
        var (metadata, markdown) = ParseFrontmatter(raw);

        // Only serve published articles
        if (!string.Equals(metadata.Status, "published", StringComparison.OrdinalIgnoreCase))
            return null;

        return new ArticleResponse(path, metadata, markdown);
    }

    public string? GetImagePath(string relativePath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(_settings.ClonePath, relativePath));
        // Security: ensure the resolved path stays within the clone directory
        var cloneRoot = Path.GetFullPath(_settings.ClonePath);
        if (!fullPath.StartsWith(cloneRoot + Path.DirectorySeparatorChar))
            return null;
        return File.Exists(fullPath) ? fullPath : null;
    }

    // ── Parsing ─────────────────────────────────────────────────────────────

    private List<ArticleIndexEntry> ParseAllArticles(string clonePath)
    {
        var entries = new List<ArticleIndexEntry>();
        foreach (var file in Directory.EnumerateFiles(clonePath, "*.md", SearchOption.AllDirectories))
        {
            // Skip template/hidden files
            var filename = Path.GetFileName(file);
            if (filename.StartsWith('_') || filename.StartsWith('.')) continue;

            try
            {
                var raw = File.ReadAllText(file);
                var (metadata, _) = ParseFrontmatter(raw);

                if (!string.Equals(metadata.Status, "published", StringComparison.OrdinalIgnoreCase))
                    continue;

                var relative = Path.GetRelativePath(clonePath, file)
                    .Replace(Path.DirectorySeparatorChar, '/');
                var withoutExt = relative[..^3]; // remove ".md"
                var parts = withoutExt.Split('/');

                if (parts.Length < 2) continue; // skip root-level files (README, etc.)

                var category = parts[0];
                var slug = parts[^1];
                var articlePath = withoutExt;

                entries.Add(new ArticleIndexEntry(articlePath, category, slug, metadata));
            }
            catch (Exception ex)
            {
                logger.LogWarning("Failed to parse {File}: {Error}", file, ex.Message);
            }
        }
        return entries;
    }

    private AcademyIndex BuildIndex(List<ArticleIndexEntry> entries, DateTime syncedAt)
    {
        var featured = entries
            .Where(e => e.Metadata.Featured)
            .OrderByDescending(e => e.Metadata.DateUpdated)
            .FirstOrDefault();

        var recent = entries
            .OrderByDescending(e => e.Metadata.DateCreated)
            .Take(5)
            .ToArray();

        var categories = entries
            .GroupBy(e => e.Category)
            .Select(g => new AcademyCategory(g.Key, Capitalise(g.Key.Replace('-', ' ')), g.Count()))
            .OrderBy(c => c.DisplayName)
            .ToArray();

        return new AcademyIndex(featured, recent, categories, syncedAt, entries.Count);
    }

    private (ArticleMetadata Metadata, string Markdown) ParseFrontmatter(string raw)
    {
        var match = FrontmatterRegex.Match(raw);
        if (!match.Success)
            return (DefaultMetadata(), raw);

        var yamlBlock = match.Groups[1].Value;
        var body = match.Groups[2].Value;

        try
        {
            var dict = _yaml.Deserialize<Dictionary<string, object>>(yamlBlock);

            return (new ArticleMetadata(
                Title: dict.GetString("title"),
                Description: dict.GetString("description"),
                Author: dict.GetString("author"),
                Tags: dict.GetStringArray("tags"),
                DateCreated: dict.GetDate("date_created"),
                DateUpdated: dict.GetDate("date_updated"),
                Featured: dict.GetBool("featured"),
                Status: dict.GetString("status", "draft")
            ), body.TrimStart());
        }
        catch (Exception ex)
        {
            logger.LogWarning("Failed to parse YAML frontmatter: {Error}", ex.Message);
            return (DefaultMetadata(), body.TrimStart());
        }
    }

    private static ArticleMetadata DefaultMetadata() =>
        new(string.Empty, string.Empty, string.Empty, [], null, null, false, "draft");

    private static string Capitalise(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpper(s[0]) + s[1..];

    // ── Insights ────────────────────────────────────────────────────────────

    public async Task TrackArticleRead(string articlePath, string visitorUserId)
    {
        await db.AcademyReads.InsertOneAsync(new AcademyRead
        {
            ArticlePath = articlePath,
            VisitorUserId = visitorUserId,
            ReadAt = DateTime.UtcNow
        });
    }

    public async Task<AcademyArticleInsightsResponse> GetArticleInsights(string articlePath)
    {
        var reads = await db.AcademyReads
            .Find(r => r.ArticlePath == articlePath)
            .SortByDescending(r => r.ReadAt)
            .ToListAsync();

        var totalReads = reads.Count;
        var visitorIds = reads.Select(r => r.VisitorUserId).Distinct().ToList();
        var visitors = await db.Users.Find(u => visitorIds.Contains(u.Id)).ToListAsync();
        var visitorMap = visitors.ToDictionary(u => u.Id);

        var readers = reads
            .GroupBy(r => r.VisitorUserId)
            .Select(g =>
            {
                var latest = g.First();
                visitorMap.TryGetValue(latest.VisitorUserId, out var user);
                return new AcademyReaderEntry
                {
                    Slug = user?.Slug ?? "",
                    Username = user?.AlternativeName ?? user?.DiscordUsername ?? "Unknown",
                    AvatarUrl = user?.ProfileImageFilename,
                    ReadAt = latest.ReadAt
                };
            })
            .ToList();

        var reactions = await db.Reactions
            .Find(r => r.TargetId == articlePath && r.TargetType == "academy_article")
            .ToListAsync();

        var reactorUserIds = reactions.Select(r => r.UserId).Distinct().ToList();
        var reactorUsers = await db.Users.Find(u => reactorUserIds.Contains(u.Id)).ToListAsync();
        var reactorMap = reactorUsers.ToDictionary(u => u.Id);

        var emojiKeys = reactions.Select(r => r.EmojiKey).Distinct().ToList();
        var emojis = await db.AvailableEmojis.Find(e => emojiKeys.Contains(e.Key)).ToListAsync();
        var emojiDefs = emojis.ToDictionary(e => e.Key);

        var reactionGroups = reactions
            .GroupBy(r => r.EmojiKey)
            .Select(g =>
            {
                emojiDefs.TryGetValue(g.Key, out var emoji);
                return new ReactionGroupWithReactors
                {
                    EmojiKey = g.Key,
                    Emoji = emoji?.Emoji ?? g.Key,
                    Label = emoji?.Label ?? g.Key,
                    Reactors = g.Select(r =>
                    {
                        reactorMap.TryGetValue(r.UserId, out var user);
                        return new ReactionReactorEntry
                        {
                            Slug = user?.Slug ?? "",
                            Username = user?.AlternativeName ?? user?.DiscordUsername ?? "Unknown",
                            AvatarUrl = user?.ProfileImageFilename
                        };
                    }).ToList()
                };
            })
            .OrderByDescending(g => g.Reactors.Count)
            .ToList();

        return new AcademyArticleInsightsResponse
        {
            TotalReads = totalReads,
            UniqueReaders = visitorIds.Count,
            Readers = readers,
            ReactionGroups = reactionGroups
        };
    }

    public async Task<List<AcademyReadExportEntry>> GetArticleReadExport(
        string articlePath, DateTime? from, DateTime? to)
    {
        var filter = Builders<AcademyRead>.Filter.Eq(r => r.ArticlePath, articlePath);

        if (from.HasValue)
            filter &= Builders<AcademyRead>.Filter.Gte(r => r.ReadAt, from.Value);
        if (to.HasValue)
            filter &= Builders<AcademyRead>.Filter.Lte(r => r.ReadAt, to.Value);

        var reads = await db.AcademyReads
            .Find(filter)
            .SortByDescending(r => r.ReadAt)
            .ToListAsync();

        var visitorIds = reads.Select(r => r.VisitorUserId).Distinct().ToList();
        var visitors = await db.Users.Find(u => visitorIds.Contains(u.Id)).ToListAsync();
        var visitorMap = visitors.ToDictionary(u => u.Id);

        return reads.Select(r =>
        {
            visitorMap.TryGetValue(r.VisitorUserId, out var user);
            return new AcademyReadExportEntry
            {
                Username = user?.AlternativeName ?? user?.DiscordUsername ?? "Unknown",
                Slug = user?.Slug ?? "",
                ReadAt = r.ReadAt
            };
        }).ToList();
    }

    private static async Task<(bool Success, string Error)> RunGit(params string[] arguments)
    {
        var psi = new ProcessStartInfo("git")
        {
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var arg in arguments)
            psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi)!;
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        return (process.ExitCode == 0, stderr);
    }
}

// ── Dictionary extension helpers ────────────────────────────────────────────

internal static class YamlDictExtensions
{
    public static string GetString(this Dictionary<string, object> d, string key, string fallback = "")
        => d.TryGetValue(key, out var v) && v is string s ? s : fallback;

    public static bool GetBool(this Dictionary<string, object> d, string key)
        => d.TryGetValue(key, out var v) && v is bool b && b;

    public static string[] GetStringArray(this Dictionary<string, object> d, string key)
    {
        if (!d.TryGetValue(key, out var v)) return [];
        if (v is List<object> list) return [.. list.Select(i => i?.ToString() ?? string.Empty)];
        return [];
    }

    public static DateOnly? GetDate(this Dictionary<string, object> d, string key)
    {
        if (!d.TryGetValue(key, out var v)) return null;
        if (v is DateTime dt) return DateOnly.FromDateTime(dt);
        if (v is string s && DateOnly.TryParse(s, out var parsed)) return parsed;
        return null;
    }
}
