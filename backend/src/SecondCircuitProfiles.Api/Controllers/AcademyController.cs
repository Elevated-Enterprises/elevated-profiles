using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/academy")]
public class AcademyController(IAcademyService academyService) : ControllerBase
{
    private string? GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

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

        // Track read for authenticated non-admin users
        var userId = GetUserId();
        var isAdmin = User.FindFirst("is_admin")?.Value == "true";
        if (userId != null && !isAdmin)
            _ = academyService.TrackArticleRead(path, userId);

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

    [HttpGet("insights")]
    [Authorize(Policy = "RequireAdmin")]
    [ProducesResponseType<AcademyArticleInsightsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetInsights([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path) || path.Contains("..") || path.StartsWith('/'))
            return BadRequest();

        var insights = await academyService.GetArticleInsights(path);
        return Ok(insights);
    }

    [HttpGet("insights/export")]
    [Authorize(Policy = "RequireAdmin")]
    [ProducesResponseType<List<AcademyReadExportEntry>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExportInsights(
        [FromQuery] string path,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        if (string.IsNullOrWhiteSpace(path) || path.Contains("..") || path.StartsWith('/'))
            return BadRequest();

        var entries = await academyService.GetArticleReadExport(path, from, to);
        return Ok(entries);
    }
}
