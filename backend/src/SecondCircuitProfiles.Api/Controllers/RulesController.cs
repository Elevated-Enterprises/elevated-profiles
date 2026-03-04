using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/rules")]
[Produces("application/json")]
public class RulesController(IRuleService ruleService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetRules()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var rules = await ruleService.GetAll(userId);
        return Ok(rules);
    }

    // Literal route must be declared before the {id} route to avoid ambiguity
    [Authorize]
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)!.Value;
        var count = await ruleService.GetUnreadCountAsync(userId);
        return Ok(new { count });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRule(string id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var rule = await ruleService.GetById(id, userId);
        if (rule == null) return NotFound();
        return Ok(rule);
    }

    [Authorize]
    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkRead(string id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)!.Value;
        await ruleService.MarkReadAsync(userId, id);
        return NoContent();
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPost]
    public async Task<IActionResult> CreateRule([FromBody] RuleRequest request)
    {
        var rule = await ruleService.Create(request);
        return CreatedAtAction(nameof(GetRule), new { id = rule.Id }, rule);
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPut("order")]
    public async Task<IActionResult> ReorderRules([FromBody] RuleReorderRequest request)
    {
        await ruleService.ReorderAsync(request.RuleIds);
        return NoContent();
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRule(string id, [FromBody] RuleRequest request)
    {
        var rule = await ruleService.Update(id, request);
        if (rule == null) return NotFound();
        return Ok(rule);
    }

    [Authorize(Policy = "RequireAdmin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRule(string id)
    {
        var deleted = await ruleService.Delete(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
