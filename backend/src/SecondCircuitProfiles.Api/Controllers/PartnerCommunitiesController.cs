using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/partner-communities")]
[Produces("application/json")]
public class PartnerCommunitiesController(IPartnerCommunityService partnerCommunityService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<List<PartnerCommunityResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPartnerCommunities()
    {
        var communities = await partnerCommunityService.GetAll();
        return Ok(communities.Select(c => new PartnerCommunityResponse
        {
            Id = c.Id,
            Name = c.Name,
            DiscordInviteUrl = c.DiscordInviteUrl,
            CreatedAt = c.CreatedAt
        }).ToList());
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPost]
    [ProducesResponseType<PartnerCommunityResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreatePartnerCommunity([FromBody] PartnerCommunityCreateRequest request)
    {
        try
        {
            var community = await partnerCommunityService.Create(request.Name, request.DiscordInviteUrl);
            var response = new PartnerCommunityResponse
            {
                Id = community.Id,
                Name = community.Name,
                DiscordInviteUrl = community.DiscordInviteUrl,
                CreatedAt = community.CreatedAt
            };
            return CreatedAtAction(nameof(GetPartnerCommunities), response);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError.Category == MongoDB.Driver.ServerErrorCategory.DuplicateKey)
        {
            return Conflict(new ErrorResponse { Error = $"A partner community with the name '{request.Name}' already exists." });
        }
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeletePartnerCommunity(string id)
    {
        var deleted = await partnerCommunityService.Delete(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
