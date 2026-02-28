using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/community-roles")]
[Produces("application/json")]
public class CommunityRolesController(ICommunityRoleService communityRoleService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<List<CommunityRoleResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCommunityRoles()
    {
        var roles = await communityRoleService.GetAll();
        return Ok(roles.Select(r => new CommunityRoleResponse
        {
            Id = r.Id,
            Name = r.Name,
            CreatedAt = r.CreatedAt
        }).ToList());
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPost]
    [ProducesResponseType<CommunityRoleResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateCommunityRole([FromBody] CommunityRoleCreateRequest request)
    {
        try
        {
            var role = await communityRoleService.Create(request.Name);
            var response = new CommunityRoleResponse
            {
                Id = role.Id,
                Name = role.Name,
                CreatedAt = role.CreatedAt
            };
            return CreatedAtAction(nameof(GetCommunityRoles), response);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError.Category == MongoDB.Driver.ServerErrorCategory.DuplicateKey)
        {
            return Conflict(new ErrorResponse { Error = $"A community role with the name '{request.Name}' already exists." });
        }
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteCommunityRole(string id)
    {
        var deleted = await communityRoleService.Delete(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
