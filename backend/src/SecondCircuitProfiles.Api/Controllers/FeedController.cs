using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/feed")]
[Produces("application/json")]
public class FeedController(IFeedService feedService, ISocialService socialService) : ControllerBase
{
    private string? GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    [HttpGet("activity")]
    [ProducesResponseType<List<FeedItemResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActivity(
        [FromQuery] string? cursor = null,
        [FromQuery] int limit = 30)
    {
        if (limit < 1) limit = 1;
        if (limit > 100) limit = 100;

        var userId = GetUserId();
        var followingIds = new List<string>();
        var ignoringIds = new List<string>();

        if (userId != null)
        {
            followingIds = await socialService.GetFollowingIds(userId);
            ignoringIds = await socialService.GetIgnoringIds(userId);
        }

        var items = await feedService.GetFeed(userId, followingIds, ignoringIds, cursor, limit);
        return Ok(items);
    }
}
