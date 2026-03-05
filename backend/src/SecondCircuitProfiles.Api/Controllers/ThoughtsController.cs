using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/thoughts")]
[Produces("application/json")]
public class ThoughtsController(
    IThoughtService thoughtService,
    ISocialService socialService,
    IUserService userService,
    IImageService imageService) : ControllerBase
{
    private string? GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    private bool IsAdmin() => User.FindFirst("is_admin")?.Value == "true";

    [HttpGet]
    [ProducesResponseType<List<ThoughtListItemResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetThoughts(
        [FromQuery] string? tag,
        [FromQuery] bool followedFirst = true,
        [FromQuery] string? cursor = null,
        [FromQuery] int limit = 20)
    {
        if (limit < 1) limit = 1;
        if (limit > 50) limit = 50;

        var userId = GetUserId();
        var followingIds = new List<string>();
        var ignoringIds = new List<string>();

        if (userId != null)
        {
            followingIds = await socialService.GetFollowingIds(userId);
            ignoringIds = await socialService.GetIgnoringIds(userId);
        }

        var thoughts = await thoughtService.GetGlobalThoughts(
            userId, followingIds, ignoringIds, tag, followedFirst, cursor, limit);
        return Ok(thoughts);
    }

    [HttpGet("user/{userSlug}")]
    [ProducesResponseType<List<ThoughtListItemResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetThoughtsByUser(string userSlug)
    {
        var user = await userService.GetBySlug(userSlug);
        if (user == null) return NotFound();

        var requestingUserId = GetUserId();
        var thoughts = await thoughtService.GetThoughtsByUser(user.Id, requestingUserId);
        return Ok(thoughts);
    }

    [HttpGet("slug/{slug}")]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetThoughtBySlug(string slug)
    {
        var userId = GetUserId();
        var thought = await thoughtService.GetThoughtBySlug(slug, userId);
        if (thought == null) return NotFound();
        return Ok(thought);
    }

    [HttpGet("{id}")]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetThought(string id)
    {
        var userId = GetUserId();
        var thought = await thoughtService.GetThought(id, userId);
        if (thought == null) return NotFound();
        return Ok(thought);
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> CreateThought([FromBody] ThoughtCreateRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var (thought, error) = await thoughtService.CreateThought(userId, request);
        if (error != null)
        {
            if (error.Contains("Rate limit"))
                return StatusCode(StatusCodes.Status429TooManyRequests, new { error });
            return BadRequest(new { error });
        }

        return CreatedAtAction(nameof(GetThought), new { id = thought!.Id }, thought);
    }

    [HttpPut("{id}")]
    [Authorize]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateThought(string id, [FromBody] ThoughtUpdateRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var thought = await thoughtService.UpdateThought(id, userId, request);
        if (thought == null) return NotFound();
        return Ok(thought);
    }

    [HttpDelete("{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteThought(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var deleted = await thoughtService.DeleteThought(id, userId, IsAdmin());
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpPatch("{id}/pin")]
    [Authorize]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TogglePin(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var thought = await thoughtService.TogglePin(id, userId);
        if (thought == null) return NotFound();
        return Ok(thought);
    }

    [HttpPost("{id}/tags")]
    [Authorize(Policy = "RequireAdmin")]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateTags(string id, [FromBody] ThoughtTagsUpdateRequest request)
    {
        var thought = await thoughtService.UpdateTags(id, request);
        if (thought == null) return NotFound();
        return Ok(thought);
    }

    [HttpPost("{id}/image")]
    [Authorize]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadThoughtImage(string id, IFormFile file)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var filename = await imageService.SaveImage(file);
            var thought = await thoughtService.UpdateImage(id, userId, filename);
            if (thought == null)
            {
                imageService.DeleteImage(filename);
                return NotFound();
            }
            return Ok(thought);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id}/image")]
    [Authorize]
    [ProducesResponseType<ThoughtResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteThoughtImage(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var thought = await thoughtService.GetThought(id, userId);
        if (thought == null) return NotFound();
        if (!thought.IsOwnThought) return Forbid();

        if (thought.ImageUrl != null)
            imageService.DeleteImage(thought.ImageUrl);

        var updated = await thoughtService.UpdateImage(id, userId, null);
        return Ok(updated);
    }

    [HttpPatch("{id}/hidden")]
    [Authorize(Policy = "RequireAdmin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetThoughtHidden(string id, [FromBody] SetHiddenRequest request)
    {
        var updated = await thoughtService.SetHidden(id, request.Hidden);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpGet("{id}/insights")]
    [Authorize]
    [ProducesResponseType<ThoughtInsightsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInsights(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var insights = await thoughtService.GetThoughtInsights(id, userId);
        if (insights == null) return NotFound();
        return Ok(insights);
    }

    [HttpGet("rate-limit")]
    [Authorize]
    [ProducesResponseType<ThoughtRateLimitResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRateLimit()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var rateLimit = await thoughtService.GetRateLimit(userId);
        return Ok(rateLimit);
    }
}
