using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SecondCircuitProfiles.Api.Configuration;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController(
    IDiscordService discordService,
    IUserService userService,
    ITokenService tokenService,
    IOptions<DiscordSettings> discordSettings) : ControllerBase
{
    private readonly DiscordSettings _discordSettings = discordSettings.Value;

    [HttpGet("config")]
    [ProducesResponseType<AuthConfigResponse>(StatusCodes.Status200OK)]
    public IActionResult GetConfig([FromQuery] string? redirectUri = null)
    {
        var effectiveRedirectUri = redirectUri
            ?? _discordSettings.RedirectUriOverride
            ?? _discordSettings.RedirectUri;

        var clientId = _discordSettings.ClientId;
        var authUrl = $"https://discord.com/api/oauth2/authorize" +
            $"?client_id={clientId}" +
            $"&redirect_uri={Uri.EscapeDataString(effectiveRedirectUri)}" +
            $"&response_type=code" +
            $"&scope=identify%20guilds";

        return Ok(new AuthConfigResponse
        {
            ClientId = clientId,
            RedirectUri = effectiveRedirectUri,
            AuthorizationUrl = authUrl
        });
    }

    [HttpPost("callback")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Callback([FromBody] DiscordCallbackRequest request)
    {
        var result = await discordService.AuthenticateUser(request.Code);
        if (result is null)
            return BadRequest(new ErrorResponse { Error = "Failed to authenticate with Discord." });

        if (!result.IsMember)
            return StatusCode(403, new ErrorResponse { Error = "You must be a member of the Discord server to use this service." });

        var user = await userService.FindOrCreate(result.Id, result.Username, result.IsAdmin);

        var token = tokenService.GenerateToken(user);

        return Ok(new AuthResponse
        {
            Token = token,
            User = MapToUserResponse(user, true)
        });
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMe()
    {
        var slug = User.FindFirstValue("slug");
        if (slug is null) return Unauthorized();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        return Ok(MapToUserResponse(user, true));
    }

    private static UserResponse MapToUserResponse(Models.User user, bool isOwn)
    {
        return new UserResponse
        {
            UserId = user.Id,
            Slug = user.Slug,
            DiscordUsername = user.DiscordUsername,
            Visibility = user.Visibility,
            ProfileImageUrl = user.ProfileImageFilename,
            AlternativeName = user.AlternativeName,
            DateOfBirth = user.DateOfBirth,
            Country = user.Country,
            City = user.City,
            Bio = user.Bio,
            IsOwnProfile = isOwn,
            IsAdmin = user.IsAdmin,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}
