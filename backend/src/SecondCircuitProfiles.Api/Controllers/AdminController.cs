using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "RequireAdmin")]
[Produces("application/json")]
public class AdminController(
    IAuditService auditService,
    IUserService userService,
    IEmojiService emojiService,
    ITagService tagService,
    IThoughtSettingsService thoughtSettingsService) : ControllerBase
{
    [HttpGet("audit")]
    [ProducesResponseType<PaginatedResponse<AuditLogEntryResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAuditLog(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 100) pageSize = 100;

        var result = await auditService.GetAuditLog(page, pageSize);
        return Ok(result);
    }

    [HttpPut("users/{slug}/blocked")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetUserBlocked(string slug, [FromBody] SetBlockedRequest request)
    {
        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        await userService.SetBlocked(slug, request.Blocked);
        return NoContent();
    }

    [HttpDelete("users/{slug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteUser(string slug)
    {
        var deleted = await userService.DeleteUser(slug);
        if (!deleted) return NotFound();
        return NoContent();
    }

    // ── Emoji Management ────────────────────────────────────────────────────

    [HttpGet("emojis")]
    [ProducesResponseType<List<AvailableEmojiResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEmojis()
        => Ok(await emojiService.GetAll());

    [HttpPost("emojis")]
    [ProducesResponseType<AvailableEmojiResponse>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateEmoji([FromBody] AvailableEmojiCreateRequest request)
    {
        var emoji = await emojiService.Create(request);
        return CreatedAtAction(nameof(GetEmojis), emoji);
    }

    [HttpPatch("emojis/{id}")]
    [ProducesResponseType<AvailableEmojiResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleEmojiActive(string id)
    {
        var emoji = await emojiService.ToggleActive(id);
        if (emoji is null) return NotFound();
        return Ok(emoji);
    }

    // ── Tag Management ───────────────────────────────────────────────────────

    [HttpGet("tags")]
    [ProducesResponseType<List<TagResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTags()
        => Ok(await tagService.GetAll());

    [HttpPost("tags")]
    [ProducesResponseType<TagResponse>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTag([FromBody] TagCreateRequest request)
    {
        var tag = await tagService.Create(request);
        return CreatedAtAction(nameof(GetTags), tag);
    }

    [HttpDelete("tags/{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTag(string id)
    {
        var deleted = await tagService.Delete(id);
        if (!deleted) return NotFound();
        return NoContent();
    }

    // ── Thought Settings ─────────────────────────────────────────────────────

    [HttpGet("thought-settings")]
    [ProducesResponseType<ThoughtSettingsResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetThoughtSettings()
        => Ok(await thoughtSettingsService.GetSettings());

    [HttpPut("thought-settings")]
    [ProducesResponseType<ThoughtSettingsResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateThoughtSettings([FromBody] ThoughtSettingsUpdateRequest request)
        => Ok(await thoughtSettingsService.UpdateSettings(request));

    [HttpPut("thought-settings/user/{userId}")]
    [ProducesResponseType<ThoughtSettingsResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetUserThoughtOverride(string userId, [FromBody] ThoughtUserOverrideRequest request)
        => Ok(await thoughtSettingsService.SetUserOverride(userId, request));
}
