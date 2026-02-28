using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

public class CreatePigGameRequest
{
    public string? CustomName { get; set; }
}

public class CreatePigGameResponse
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;
}

[ApiController]
[Route("api/pig")]
[Authorize]
[Produces("application/json")]
public class PigController(IPigService pigService, IUserService userService) : ControllerBase
{
    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private string Username =>
        User.FindFirstValue("discord_username") ?? "Unknown";

    private string? UserSlug =>
        User.FindFirstValue("slug");

    [HttpPost]
    public async Task<IActionResult> CreateGame([FromBody] CreatePigGameRequest request)
    {
        // Fetch avatar URL from user profile
        string? avatarUrl = null;
        if (UserSlug != null)
        {
            var user = await userService.GetBySlug(UserSlug);
            avatarUrl = user?.ProfileImageFilename;
        }

        var (game, error) = await pigService.CreateGameAsync(
            UserId, Username, UserSlug, avatarUrl, request.CustomName);

        if (error != null)
            return BadRequest(new { error });

        return Ok(new CreatePigGameResponse { Slug = game.Slug, Name = game.Name });
    }

    [HttpGet]
    public async Task<IActionResult> GetOpenGames([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 50) pageSize = 50;

        var games = await pigService.GetOpenGamesAsync(page, pageSize);
        var total = await pigService.GetOpenGamesCountAsync();

        return Ok(new
        {
            items = games,
            page,
            pageSize,
            totalCount = total,
            totalPages = (int)Math.Ceiling((double)total / pageSize)
        });
    }
}
