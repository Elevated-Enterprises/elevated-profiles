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
        var rules = await ruleService.GetAll();
        return Ok(rules);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetRule(string id)
    {
        var rule = await ruleService.GetById(id);
        if (rule == null) return NotFound();
        return Ok(rule);
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
