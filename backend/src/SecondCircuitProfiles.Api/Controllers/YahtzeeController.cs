using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

public class CreateYahtzeeGameRequest
{
    public string? CustomName { get; set; }
}

public class CreateYahtzeeGameResponse
{
    public string Slug { get; set; } = null!;
    public string Name { get; set; } = null!;
}

[ApiController]
[Route("api/yahtzee")]
[Authorize]
[Produces("application/json")]
public class YahtzeeController(IYahtzeeService yahtzeeService, IUserService userService) : ControllerBase
{
    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private string Username =>
        User.FindFirstValue("discord_username") ?? "Unknown";

    private string? AlternativeName =>
        User.FindFirstValue("alternative_name");

    private string? UserSlug =>
        User.FindFirstValue("slug");

    [HttpPost]
    public async Task<IActionResult> CreateGame([FromBody] CreateYahtzeeGameRequest request)
    {
        string? avatarUrl = null;
        if (UserSlug != null)
        {
            var user = await userService.GetBySlug(UserSlug);
            avatarUrl = user?.ProfileImageFilename;
        }

        var (game, error) = await yahtzeeService.CreateGameAsync(
            UserId, Username, AlternativeName, UserSlug, avatarUrl, request.CustomName);

        if (error != null)
            return BadRequest(new { error });

        return Ok(new CreateYahtzeeGameResponse { Slug = game.Slug, Name = game.Name });
    }

    [HttpGet]
    public async Task<IActionResult> GetOpenGames([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > 50) pageSize = 50;

        var games = await yahtzeeService.GetOpenGamesAsync(page, pageSize);
        var total = await yahtzeeService.GetOpenGamesCountAsync();

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
