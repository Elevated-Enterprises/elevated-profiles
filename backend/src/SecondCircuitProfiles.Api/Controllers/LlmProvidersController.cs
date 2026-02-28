using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/llm-providers")]
[Produces("application/json")]
public class LlmProvidersController(ILlmProviderService llmProviderService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<List<LlmProviderResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLlmProviders()
    {
        var providers = await llmProviderService.GetAll();
        return Ok(providers.Select(p => new LlmProviderResponse
        {
            Id = p.Id,
            Name = p.Name,
            CreatedAt = p.CreatedAt
        }).ToList());
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPost]
    [ProducesResponseType<LlmProviderResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateLlmProvider([FromBody] LlmProviderCreateRequest request)
    {
        try
        {
            var provider = await llmProviderService.Create(request.Name);
            var response = new LlmProviderResponse
            {
                Id = provider.Id,
                Name = provider.Name,
                CreatedAt = provider.CreatedAt
            };
            return CreatedAtAction(nameof(GetLlmProviders), response);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (ex.WriteError.Category == MongoDB.Driver.ServerErrorCategory.DuplicateKey)
        {
            return Conflict(new ErrorResponse { Error = $"An LLM provider with the name '{request.Name}' already exists." });
        }
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteLlmProvider(string id)
    {
        var deleted = await llmProviderService.Delete(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
