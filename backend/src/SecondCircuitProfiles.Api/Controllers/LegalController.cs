using Microsoft.AspNetCore.Mvc;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/legal")]
[Produces("application/json")]
public class LegalController : ControllerBase
{
    private static readonly string LegalPath = "/app/legal";

    [HttpGet("imprint")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetImprint()
    {
        var path = Path.Combine(LegalPath, "imprint.md");
        if (!System.IO.File.Exists(path))
            return NotFound(new { error = "imprint.md not found", setup = "Mount a directory containing imprint.md at /app/legal in the backend container." });

        var content = System.IO.File.ReadAllText(path);
        return Ok(new { content });
    }

    [HttpGet("privacy")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetPrivacy()
    {
        var path = Path.Combine(LegalPath, "privacy.md");
        if (!System.IO.File.Exists(path))
            return NotFound(new { error = "privacy.md not found", setup = "Mount a directory containing privacy.md at /app/legal in the backend container." });

        var content = System.IO.File.ReadAllText(path);
        return Ok(new { content });
    }
}
