using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/social")]
[Authorize]
[Produces("application/json")]
public class SocialController(ISocialService socialService, IUserService userService) : ControllerBase
{
    private string GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? throw new InvalidOperationException("No user id in token");

    [HttpGet("state")]
    [ProducesResponseType<SocialStateResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSocialState()
        => Ok(await socialService.GetSocialState(GetUserId()));

    [HttpPost("follow/{userSlug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Follow(string userSlug)
    {
        var target = await userService.GetBySlug(userSlug);
        if (target == null) return NotFound();

        var fromId = GetUserId();
        if (fromId == target.Id) return BadRequest(new { error = "Cannot follow yourself." });

        await socialService.Follow(fromId, target.Id);
        return NoContent();
    }

    [HttpDelete("follow/{userSlug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unfollow(string userSlug)
    {
        var target = await userService.GetBySlug(userSlug);
        if (target == null) return NotFound();

        await socialService.Unfollow(GetUserId(), target.Id);
        return NoContent();
    }

    [HttpPost("ignore/{userSlug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Ignore(string userSlug)
    {
        var target = await userService.GetBySlug(userSlug);
        if (target == null) return NotFound();

        var fromId = GetUserId();
        if (fromId == target.Id) return BadRequest(new { error = "Cannot ignore yourself." });

        await socialService.Ignore(fromId, target.Id);
        return NoContent();
    }

    [HttpDelete("ignore/{userSlug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveIgnore(string userSlug)
    {
        var target = await userService.GetBySlug(userSlug);
        if (target == null) return NotFound();

        await socialService.RemoveIgnore(GetUserId(), target.Id);
        return NoContent();
    }

    [HttpPost("block/{userSlug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BlockUser(string userSlug)
    {
        var target = await userService.GetBySlug(userSlug);
        if (target == null) return NotFound();

        var fromId = GetUserId();
        if (fromId == target.Id) return BadRequest(new { error = "Cannot block yourself." });

        await socialService.Block(fromId, target.Id);
        return NoContent();
    }

    [HttpDelete("block/{userSlug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnblockUser(string userSlug)
    {
        var target = await userService.GetBySlug(userSlug);
        if (target == null) return NotFound();

        await socialService.Unblock(GetUserId(), target.Id);
        return NoContent();
    }
}
