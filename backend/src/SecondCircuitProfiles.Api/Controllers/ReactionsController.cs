using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/reactions")]
[Produces("application/json")]
public class ReactionsController(IReactionService reactionService, IEmojiService emojiService) : ControllerBase
{
    private string? GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    [HttpGet("emojis")]
    [ProducesResponseType<List<AvailableEmojiResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveEmojis()
        => Ok(await emojiService.GetAll(activeOnly: true));

    [HttpGet("{targetId}")]
    [ProducesResponseType<List<ReactionGroupResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReactions(string targetId, [FromQuery] string targetType = "thought")
    {
        var userId = GetUserId();
        var reactions = await reactionService.GetReactions(targetId, targetType, userId);
        return Ok(reactions);
    }

    [HttpPost]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddReaction([FromBody] ReactionAddRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var added = await reactionService.AddReaction(request.TargetId, request.TargetType, userId, request.EmojiKey);
        if (!added) return BadRequest(new { error = "Reaction already exists or emoji is inactive." });
        return NoContent();
    }

    [HttpDelete]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveReaction([FromBody] ReactionRemoveRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var removed = await reactionService.RemoveReaction(request.TargetId, request.TargetType, userId, request.EmojiKey);
        if (!removed) return NotFound();
        return NoContent();
    }
}
