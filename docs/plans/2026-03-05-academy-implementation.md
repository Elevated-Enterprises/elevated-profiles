# Second Circuit Academy — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/academy` section to profiles.secondcircuit.io that renders markdown content from a public GitHub repo managed by Ann in Obsidian.

**Architecture:** C# backend clones the repo, parses frontmatter (YamlDotNet), serves raw markdown + images. React frontend renders markdown via `react-markdown` with GFM + wikilink plugins.

**Tech Stack:**
- Backend: ASP.NET Core 10, YamlDotNet (new), `Process.Start` for git
- Frontend: react-markdown (existing), remark-gfm + remark-wiki-link + rehype-highlight + rehype-slug (new packages)
- Tailwind typography: already installed (`@tailwindcss/typography`)

**Design doc:** `docs/plans/2026-03-05-academy-design.md`

---

## Task 1: Backend — AcademySettings configuration class

**Files:**
- Create: `backend/src/SecondCircuitProfiles.Api/Configuration/AcademySettings.cs`
- Modify: `backend/src/SecondCircuitProfiles.Api/appsettings.json`

**Step 1: Create AcademySettings.cs**

```csharp
namespace SecondCircuitProfiles.Api.Configuration;

public class AcademySettings
{
    public const string SectionName = "Academy";

    public string RepoUrl { get; set; } = string.Empty;
    public string ClonePath { get; set; } = "./academy-content";
    public int NewArticleDays { get; set; } = 30;
}
```

**Step 2: Add Academy section to appsettings.json**

Open `appsettings.json` and add after the existing sections:

```json
"Academy": {
  "RepoUrl": "",
  "ClonePath": "./academy-content",
  "NewArticleDays": 30
}
```

**Step 3: Commit**

```bash
git add backend/src/SecondCircuitProfiles.Api/Configuration/AcademySettings.cs
git add backend/src/SecondCircuitProfiles.Api/appsettings.json
git commit -m "Add AcademySettings configuration"
```

---

## Task 2: Backend — AcademyModels (DTOs and index types)

**Files:**
- Create: `backend/src/SecondCircuitProfiles.Api/Models/AcademyModels.cs`

**Step 1: Create AcademyModels.cs**

```csharp
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
```

**Step 2: Commit**

```bash
git add backend/src/SecondCircuitProfiles.Api/Models/AcademyModels.cs
git commit -m "Add Academy domain models and DTOs"
```

---

## Task 3: Backend — Install YamlDotNet NuGet package

**Files:**
- Modify: `backend/src/SecondCircuitProfiles.Api/SecondCircuitProfiles.Api.csproj`

**Step 1: Install YamlDotNet**

Run from `backend/src/SecondCircuitProfiles.Api/`:

```bash
dotnet add package YamlDotNet
```

Expected: package added to .csproj, packages restored.

**Step 2: Verify build**

```bash
dotnet build backend/src/SecondCircuitProfiles.Api
```

Expected: Build succeeded.

**Step 3: Commit**

```bash
git add backend/src/SecondCircuitProfiles.Api/SecondCircuitProfiles.Api.csproj
git commit -m "Add YamlDotNet for frontmatter parsing"
```

---

## Task 4: Backend — AcademyService

**Files:**
- Create: `backend/src/SecondCircuitProfiles.Api/Services/AcademyService.cs`

**Step 1: Create AcademyService.cs**

```csharp
using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SecondCircuitProfiles.Api.Configuration;
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
}

public class AcademyService(IOptions<AcademySettings> options, ILogger<AcademyService> logger)
    : IAcademyService
{
    private readonly AcademySettings _settings = options.Value;
    private AcademyIndex _index = new(null, [], [], null, 0);
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
            var cloneResult = await RunGit($"clone {_settings.RepoUrl} {clonePath}");
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
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-_settings.NewArticleDays));

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
        var match = Regex.Match(raw, @"^---\s*\n(.*?)\n---\s*\n?(.*)", RegexOptions.Singleline);
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
        catch
        {
            return (DefaultMetadata(), body.TrimStart());
        }
    }

    private static ArticleMetadata DefaultMetadata() =>
        new(string.Empty, string.Empty, string.Empty, [], null, null, false, "draft");

    private static string Capitalise(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpper(s[0]) + s[1..];

    private static async Task<(bool Success, string Error)> RunGit(string arguments)
    {
        var psi = new ProcessStartInfo("git", arguments)
        {
            RedirectStandardError = true,
            UseShellExecute = false,
        };
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
```

**Step 2: Build to check for errors**

```bash
dotnet build backend/src/SecondCircuitProfiles.Api
```

Expected: Build succeeded, 0 errors.

**Step 3: Commit**

```bash
git add backend/src/SecondCircuitProfiles.Api/Services/AcademyService.cs
git commit -m "Add AcademyService with git sync and frontmatter parsing"
```

---

## Task 5: Backend — AcademyController

**Files:**
- Create: `backend/src/SecondCircuitProfiles.Api/Controllers/AcademyController.cs`

**Step 1: Create AcademyController.cs**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using SecondCircuitProfiles.Api.Models;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/academy")]
public class AcademyController(IAcademyService academyService) : ControllerBase
{
    [HttpPost("sync")]
    [Authorize(Policy = "RequireAdmin")]
    [ProducesResponseType<SyncResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Sync()
    {
        var result = await academyService.Sync();
        return Ok(result);
    }

    [HttpGet("index")]
    [ProducesResponseType<AcademyIndex>(StatusCodes.Status200OK)]
    public IActionResult GetIndex() => Ok(academyService.GetIndex());

    [HttpGet("article")]
    [ProducesResponseType<ArticleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetArticle([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return BadRequest();

        // Sanitise: no path traversal
        if (path.Contains("..") || path.StartsWith('/')) return BadRequest();

        var article = academyService.GetArticle(path);
        if (article is null) return NotFound();
        return Ok(article);
    }

    [HttpGet("images/{*imagePath}")]
    public IActionResult GetImage(string imagePath)
    {
        if (string.IsNullOrWhiteSpace(imagePath)) return BadRequest();

        var fullPath = academyService.GetImagePath(imagePath);
        if (fullPath is null) return NotFound();

        var provider = new FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(fullPath, out var contentType))
            contentType = "application/octet-stream";

        return PhysicalFile(fullPath, contentType);
    }
}
```

**Step 2: Build**

```bash
dotnet build backend/src/SecondCircuitProfiles.Api
```

Expected: Build succeeded.

**Step 3: Commit**

```bash
git add backend/src/SecondCircuitProfiles.Api/Controllers/AcademyController.cs
git commit -m "Add AcademyController with sync, index, article, and image endpoints"
```

---

## Task 6: Backend — Register AcademyService in Program.cs

**Files:**
- Modify: `backend/src/SecondCircuitProfiles.Api/Program.cs`

**Step 1: Add configuration binding and service registration**

After the existing `builder.Services.Configure<CorsSettings>(...)` line, add:

```csharp
builder.Services.Configure<AcademySettings>(builder.Configuration.GetSection(AcademySettings.SectionName));
```

After the existing `builder.Services.AddSingleton<IRuleService, RuleService>();` line, add:

```csharp
builder.Services.AddSingleton<IAcademyService, AcademyService>();
```

**Step 2: Build and run**

```bash
dotnet build backend/src/SecondCircuitProfiles.Api
```

Expected: Build succeeded.

**Step 3: Quick smoke test**

Start the backend:
```bash
dotnet run --project backend/src/SecondCircuitProfiles.Api
```

In another terminal:
```bash
curl http://localhost:5246/api/academy/index
```

Expected: `{"featuredArticle":null,"recentArticles":[],"categories":[],"lastSyncedAt":null,"totalArticles":0}`

**Step 4: Commit**

```bash
git add backend/src/SecondCircuitProfiles.Api/Program.cs
git commit -m "Register AcademyService and AcademySettings in DI"
```

---

## Task 7: Backend — Update .env.example

**Files:**
- Modify: `backend/.env.example` (or wherever env example lives — check `backend/`)

**Step 1: Find and update env example**

Check if it exists:
```bash
ls backend/.env.example
```

If it exists, add:
```
# Academy content repository
Academy__RepoUrl=https://github.com/your-org/academy
Academy__ClonePath=./academy-content
Academy__NewArticleDays=30
```

If it doesn't exist, check `backend/src/SecondCircuitProfiles.Api/.env.example`.

**Step 2: Commit**

```bash
git add backend/.env.example   # or whichever file was found
git commit -m "Add Academy environment variable examples"
```

---

## Task 8: Frontend — Install new npm packages

**Working directory:** `frontend/`

**Step 1: Install packages**

```bash
cd frontend && npm install remark-gfm remark-wiki-link rehype-highlight rehype-slug
```

Expected: packages added to `package.json` and `package-lock.json`.

**Step 2: Verify no build errors**

```bash
npm run build
```

Expected: Build succeeded.

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "Add remark-gfm, remark-wiki-link, rehype-highlight, rehype-slug"
```

---

## Task 9: Frontend — Academy API functions

**Files:**
- Modify: `frontend/src/lib/api.js`

**Step 1: Add academy API functions at the end of api.js**

```js
// ── Academy ──────────────────────────────────────────────────────────────────

export const getAcademyIndex = () => api.get('/academy/index')

export const getAcademyArticle = (path) =>
  api.get('/academy/article', { params: { path } })

export const syncAcademy = () => api.post('/academy/sync')
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.js
git commit -m "Add academy API functions to api.js"
```

---

## Task 10: Frontend — AcademyMarkdownRenderer component

**Files:**
- Create: `frontend/src/components/academy/AcademyMarkdownRenderer.jsx`

Note: A `MarkdownRenderer.jsx` already exists for profile bios (uses basic `react-markdown`). The academy renderer needs wikilink + syntax highlighting support, so we create a separate one.

**Step 1: Create component**

```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function rewriteImageUri(src) {
  if (!src) return src
  // Absolute URLs pass through unchanged
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  // Relative paths get served via the backend images endpoint
  return `${BASE_URL}/api/academy/images/${src.replace(/^\//, '')}`
}

const wikiLinkOptions = {
  hrefTemplate: (permalink) => `/academy/${permalink}`,
  aliasDivider: '|',
}

export default function AcademyMarkdownRenderer({ content }) {
  if (!content) return null

  return (
    <div className="prose prose-stone dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkWikiLink, wikiLinkOptions]]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        urlTransform={(url, key) => {
          if (key === 'src') return rewriteImageUri(url)
          return url
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/academy/AcademyMarkdownRenderer.jsx
git commit -m "Add AcademyMarkdownRenderer with wikilink and syntax highlight support"
```

---

## Task 11: Frontend — AcademyLanding page

**Files:**
- Create: `frontend/src/pages/AcademyLanding.jsx`

**Step 1: Create AcademyLanding.jsx**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAcademyIndex } from '../lib/api'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isNew(dateCreated, days = 30) {
  if (!dateCreated) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(dateCreated) > cutoff
}

export default function AcademyLanding() {
  const [index, setIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAcademyIndex()
      .then((res) => setIndex(res.data))
      .catch(() => setError('Failed to load Academy content.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="max-w-4xl mx-auto py-12 text-stone-400 text-sm text-center">Loading…</div>
  )

  if (error) return (
    <div className="max-w-4xl mx-auto py-12 text-red-500 text-sm text-center">{error}</div>
  )

  const { featuredArticle, recentArticles, categories } = index

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">Second Circuit Academy</h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400">
          Knowledge, ethics, and community — curated by Ann.
        </p>
      </div>

      {featuredArticle && (
        <Link
          to={`/academy/${featuredArticle.path}`}
          className="block mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6 hover:border-amber-400 dark:hover:border-amber-500 transition-colors group"
        >
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
            Featured
          </p>
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
            {featuredArticle.metadata.title}
          </h2>
          {featuredArticle.metadata.description && (
            <p className="mt-2 text-stone-600 dark:text-stone-400 text-sm">
              {featuredArticle.metadata.description}
            </p>
          )}
          <p className="mt-3 text-amber-600 dark:text-amber-400 text-sm font-medium">Read article →</p>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {recentArticles.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Recently Added</h2>
            <ul className="space-y-3">
              {recentArticles.map((article) => (
                <li key={article.path}>
                  <Link
                    to={`/academy/${article.path}`}
                    className="group flex items-start gap-2"
                  >
                    <span className="text-sm text-stone-700 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                      {article.metadata.title}
                    </span>
                    {isNew(article.metadata.dateCreated) && (
                      <span className="flex-shrink-0 text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded font-medium">
                        New
                      </span>
                    )}
                  </Link>
                  {article.metadata.dateCreated && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                      {formatDate(article.metadata.dateCreated)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Categories</h2>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to={`/academy/${cat.slug}`}
                    className="flex items-center justify-between group rounded-xl border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3 hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
                  >
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {cat.displayName}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      {cat.articleCount} {cat.articleCount === 1 ? 'article' : 'articles'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {categories.length === 0 && recentArticles.length === 0 && (
        <p className="text-stone-400 dark:text-stone-500 text-sm">
          No content yet. Sync the Academy to load content.
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/AcademyLanding.jsx
git commit -m "Add AcademyLanding page"
```

---

## Task 12: Frontend — AcademyCategory page

**Files:**
- Create: `frontend/src/pages/AcademyCategory.jsx`

**Step 1: Create AcademyCategory.jsx**

```jsx
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAcademyIndex } from '../lib/api'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isNew(dateCreated, days = 30) {
  if (!dateCreated) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(dateCreated) > cutoff
}

export default function AcademyCategory() {
  const { category } = useParams()
  const [articles, setArticles] = useState([])
  const [categoryName, setCategoryName] = useState(category)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAcademyIndex()
      .then((res) => {
        const index = res.data
        const cat = index.categories.find((c) => c.slug === category)
        if (cat) setCategoryName(cat.displayName)

        // Filter all articles (from recentArticles + featuredArticle) by category
        // Note: the index only has recent articles; we need to call index for all.
        // For now we get all articles from the categories endpoint — we'll derive them
        // from the index structure. The backend returns recentArticles (top 5) but
        // categories have full counts. We query index and filter recentArticles by category.
        // TODO: if needed, add a GET /api/academy/category?slug=X endpoint later.
        const filtered = index.recentArticles.filter((a) => a.category === category)
        setArticles(filtered)
      })
      .catch(() => setError('Failed to load category.'))
      .finally(() => setLoading(false))
  }, [category])

  if (loading) return (
    <div className="max-w-4xl mx-auto py-12 text-stone-400 text-sm text-center">Loading…</div>
  )

  if (error) return (
    <div className="max-w-4xl mx-auto py-12 text-red-500 text-sm text-center">{error}</div>
  )

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          to="/academy"
          className="text-sm text-stone-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
        >
          ← Academy
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-stone-800 dark:text-stone-100">{categoryName}</h1>
      </div>

      {articles.length === 0 ? (
        <p className="text-stone-400 dark:text-stone-500 text-sm">No articles in this category yet.</p>
      ) : (
        <ul className="space-y-4">
          {articles.map((article) => (
            <li key={article.path}>
              <Link
                to={`/academy/${article.path}`}
                className="block rounded-2xl border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 hover:border-amber-300 dark:hover:border-amber-600 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                    {article.metadata.title}
                    {isNew(article.metadata.dateCreated) && (
                      <span className="ml-2 text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded font-medium">
                        New
                      </span>
                    )}
                  </h2>
                  {article.metadata.dateUpdated && (
                    <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
                      {formatDate(article.metadata.dateUpdated)}
                    </span>
                  )}
                </div>
                {article.metadata.description && (
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {article.metadata.description}
                  </p>
                )}
                {article.metadata.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {article.metadata.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Note:** The current index only returns the 5 most recent articles. If the category listing needs all articles, a future task can add `GET /api/academy/category?slug=X` to the backend. For Phase 1 this is acceptable.

**Step 2: Commit**

```bash
git add frontend/src/pages/AcademyCategory.jsx
git commit -m "Add AcademyCategory page"
```

---

## Task 13: Frontend — AcademyArticle page

**Files:**
- Create: `frontend/src/pages/AcademyArticle.jsx`

**Step 1: Create AcademyArticle.jsx**

```jsx
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAcademyArticle } from '../lib/api'
import AcademyMarkdownRenderer from '../components/academy/AcademyMarkdownRenderer'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AcademyArticle() {
  const { category, article } = useParams()
  const path = `${category}/${article}`
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAcademyArticle(path)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Article not found.')
        else setError('Failed to load article.')
      })
      .finally(() => setLoading(false))
  }, [path])

  if (loading) return (
    <div className="max-w-3xl mx-auto py-12 text-stone-400 text-sm text-center">Loading…</div>
  )

  if (error) return (
    <div className="max-w-3xl mx-auto py-12 text-red-500 text-sm text-center">{error}</div>
  )

  const { metadata, markdown } = data

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          to={`/academy/${category}`}
          className="text-sm text-stone-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors capitalize"
        >
          ← {category.replace(/-/g, ' ')}
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 leading-tight">
          {metadata.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-400 dark:text-stone-500">
          {metadata.author && <span>by {metadata.author}</span>}
          {metadata.dateUpdated && <span>{formatDate(metadata.dateUpdated)}</span>}
        </div>
      </header>

      <AcademyMarkdownRenderer content={markdown} />

      {metadata.tags?.length > 0 && (
        <div className="mt-10 pt-6 border-t border-stone-100 dark:border-stone-700 flex flex-wrap gap-2">
          {metadata.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-stone-100 dark:border-stone-700">
        <p className="text-xs text-stone-300 dark:text-stone-600">
          Content licensed under Creative Commons. Academy curated by Second Circuit.
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/AcademyArticle.jsx
git commit -m "Add AcademyArticle page with markdown rendering"
```

---

## Task 14: Frontend — Register Academy routes in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add imports**

After the existing `import AdminRules from './pages/AdminRules'` line, add:

```js
import AcademyLanding from './pages/AcademyLanding'
import AcademyCategory from './pages/AcademyCategory'
import AcademyArticle from './pages/AcademyArticle'
```

**Step 2: Add routes**

After the `<Route path="/thoughts/:slug" ...>` route and before the `<Route path="/admin" ...>` route, add:

```jsx
<Route path="/academy" element={<Layout><AcademyLanding /></Layout>} />
<Route path="/academy/:category" element={<Layout><AcademyCategory /></Layout>} />
<Route path="/academy/:category/:article" element={<Layout><AcademyArticle /></Layout>} />
```

**Step 3: Build to verify no errors**

```bash
npm run build
```

Expected: Build succeeded.

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "Register /academy routes in App.jsx"
```

---

## Task 15: Frontend — Add Academy sync panel to Admin page

**Files:**
- Modify: `frontend/src/pages/Admin.jsx`

**Step 1: Add AcademySyncPanel component**

After the existing `ThoughtSettingsPanel` function (around line 467) and before the `UserManagement` function (around line 469), insert:

```jsx
function AcademySyncPanel() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)
    try {
      const res = await syncAcademy()
      setResult({ success: true, ...res.data })
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error || 'Sync failed.' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-1">Academy Content</h2>
      <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
        Re-clones the Academy GitHub repository and rebuilds the content index.
      </p>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {syncing ? 'Syncing…' : 'Sync Academy Content'}
      </button>
      {result && (
        <div className={`mt-3 text-xs ${result.success ? 'text-teal-600 dark:text-teal-400' : 'text-red-500'}`}>
          {result.success
            ? `Synced ${result.articleCount} article${result.articleCount !== 1 ? 's' : ''} successfully.`
            : result.error}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add syncAcademy import**

Find the existing import from `'../lib/api'` at the top of `Admin.jsx` and add `syncAcademy` to it.

**Step 3: Add AcademySyncPanel to the Admin render output**

After the `<ThoughtSettingsPanel ...>` block (around line 717), add:

```jsx
<div className="mb-6">
  <AcademySyncPanel />
</div>
```

**Step 4: Build**

```bash
npm run build
```

Expected: Build succeeded.

**Step 5: Commit**

```bash
git add frontend/src/pages/Admin.jsx
git commit -m "Add Academy sync panel to Admin page"
```

---

## Task 16: Frontend — Add Academy link to Navbar

**Files:**
- Modify: `frontend/src/components/Navbar.jsx`

**Step 1: Read Navbar.jsx to find where to add the link**

Read the file and find the navigation links section.

**Step 2: Add Academy link**

Add a link to `/academy` alongside the other nav items. Follow the existing link style exactly.

**Step 3: Commit**

```bash
git add frontend/src/components/Navbar.jsx
git commit -m "Add Academy link to Navbar"
```

---

## Task 17: End-to-end test

**Prerequisites:** Backend running with `Academy__RepoUrl` set to a test repo (or the real one).

**Step 1: Set the env var and start backend**

```bash
Academy__RepoUrl=https://github.com/second-soul-studio/academy dotnet run --project backend/src/SecondCircuitProfiles.Api
```

(Replace with actual repo URL once available.)

**Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

**Step 3: Manual verification checklist**

- [ ] Navigate to `/academy` — landing page loads, shows empty state (no content yet)
- [ ] Log in as admin, go to `/admin`, click "Sync Academy Content"
- [ ] Sync returns success, shows article count
- [ ] Navigate to `/academy` — featured article, recent articles, categories appear
- [ ] Click a category — article listing shows
- [ ] Click an article — renders markdown with prose styling
- [ ] Wikilinks render as links (not raw `[[...]]` text)
- [ ] Code blocks have syntax highlighting
- [ ] Images load if any exist in the repo

**Step 4: Final commit (if any cleanup needed)**

```bash
git commit -m "Academy feature: end-to-end verified"
```
