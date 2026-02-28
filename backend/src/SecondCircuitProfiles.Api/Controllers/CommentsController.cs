using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Produces("application/json")]
public class CommentsController(ICommentService commentService) : ControllerBase
{
    private string? GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    private bool IsAdmin() => User.FindFirst("is_admin")?.Value == "true";

    [HttpGet("api/thoughts/{thoughtId}/comments")]
    [ProducesResponseType<List<CommentResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetComments(string thoughtId)
    {
        var userId = GetUserId();
        var comments = await commentService.GetComments(thoughtId, userId);
        return Ok(comments);
    }

    [HttpPost("api/thoughts/{thoughtId}/comments")]
    [Authorize]
    [ProducesResponseType<CommentResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateComment(string thoughtId, [FromBody] CommentCreateRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var (comment, error) = await commentService.CreateComment(thoughtId, userId, request);
        if (error != null)
        {
            if (error == "Thought not found.") return NotFound(new { error });
            return BadRequest(new { error });
        }

        return StatusCode(StatusCodes.Status201Created, comment);
    }

    [HttpDelete("api/comments/{id}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteComment(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        var deleted = await commentService.DeleteComment(id, userId, IsAdmin());
        if (!deleted) return NotFound();
        return NoContent();
    }
}
