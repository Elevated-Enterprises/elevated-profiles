using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/skills")]
[Produces("application/json")]
public class SkillsController(ISkillService skillService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<List<SkillResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSkills()
    {
        var skills = await skillService.GetAll();
        return Ok(skills.Select(s => new SkillResponse
        {
            Id = s.Id,
            Name = s.Name,
            CreatedAt = s.CreatedAt
        }).ToList());
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPost]
    [ProducesResponseType<SkillResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateSkill([FromBody] SkillCreateRequest request)
    {
        try
        {
            var skill = await skillService.Create(request.Name);
            var response = new SkillResponse
            {
                Id = skill.Id,
                Name = skill.Name,
                CreatedAt = skill.CreatedAt
            };
            return CreatedAtAction(nameof(GetSkills), response);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError.Category == MongoDB.Driver.ServerErrorCategory.DuplicateKey)
        {
            return Conflict(new ErrorResponse { Error = $"A skill with the name '{request.Name}' already exists." });
        }
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteSkill(string id)
    {
        var deleted = await skillService.Delete(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
