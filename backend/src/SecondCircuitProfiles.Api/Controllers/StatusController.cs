using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/status")]
[Produces("application/json")]
public class StatusController(IStatusService statusService, IUserService userService) : ControllerBase
{
    private string? GetUserId() => User.FindFirst("sub")?.Value
        ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    [HttpPut]
    [Authorize]
    [ProducesResponseType<StatusUpdateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SetStatus([FromBody] StatusSetRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Text))
            return BadRequest(new { error = "Status text cannot be empty." });

        var trimmed = request.Text.Trim();
        if (trimmed.Length > 60)
            return BadRequest(new { error = "Status must be 60 characters or less." });

        var status = await statusService.SetStatus(userId, trimmed);
        return Ok(status);
    }

    [HttpGet("{userSlug}")]
    [ProducesResponseType<StatusUpdateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStatus(string userSlug)
    {
        var user = await userService.GetBySlug(userSlug);
        if (user == null) return NotFound();

        var status = await statusService.GetLatestStatus(user.Id);
        if (status == null) return NotFound();
        return Ok(status);
    }
}
