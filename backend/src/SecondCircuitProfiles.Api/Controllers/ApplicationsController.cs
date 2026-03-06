using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/applications")]
[Authorize]
[Produces("application/json")]
public class ApplicationsController(IApplicationService applicationService) : ControllerBase
{
    private string GetUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? throw new InvalidOperationException("No user id in token");

    [HttpGet("available")]
    [ProducesResponseType<List<AvailableFormResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAvailableForms()
    {
        var forms = await applicationService.GetAvailableFormsAsync(GetUserId());
        return Ok(forms);
    }

    [HttpGet("my")]
    [ProducesResponseType<List<ApplicationSubmissionSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMySubmissions()
    {
        var submissions = await applicationService.GetMySubmissionsAsync(GetUserId());
        return Ok(submissions);
    }

    [HttpGet("{id}")]
    [ProducesResponseType<ApplicationSubmissionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSubmission(string id)
    {
        var submission = await applicationService.GetSubmissionAsync(id, GetUserId(), false);
        if (submission is null) return NotFound();
        return Ok(submission);
    }

    [HttpPost("start")]
    [ProducesResponseType<ApplicationSubmissionSummaryResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StartSubmission([FromBody] StartSubmissionRequest request)
    {
        var submission = await applicationService.StartSubmissionAsync(request.FormTypeId, GetUserId());
        if (submission is null)
            return BadRequest(new ErrorResponse { Error = "Form not found or not available." });

        return StatusCode(201, new ApplicationSubmissionSummaryResponse
        {
            Id = submission.Id,
            FormTypeId = submission.FormTypeId,
            FormTypeName = "",
            State = submission.State.ToString(),
            CreatedAt = submission.CreatedAt
        });
    }

    [HttpPut("{id}/answers")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SaveAnswers(string id, [FromBody] SaveAnswersRequest request)
    {
        var (success, error) = await applicationService.SaveAnswersAsync(id, GetUserId(), request.Answers);
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }

    [HttpPost("{id}/submit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(string id)
    {
        var (success, error) = await applicationService.SubmitAsync(id, GetUserId());
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }

    [HttpPost("{id}/retract")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Retract(string id)
    {
        var (success, error) = await applicationService.RetractAsync(id, GetUserId());
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }
}

public class StartSubmissionRequest
{
    public string FormTypeId { get; set; } = null!;
}
