using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/admin/applications")]
[Authorize(Policy = "RequireAdmin")]
[Produces("application/json")]
public class AdminApplicationsController(IApplicationService applicationService) : ControllerBase
{
    private string GetAdminUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? throw new InvalidOperationException("No user id in token");

    private string GetAdminDiscordUsername() => User.FindFirst("discord_username")?.Value ?? "admin";

    // ── Form types ────────────────────────────────────────────────────────────

    [HttpGet("form-types")]
    [ProducesResponseType<List<ApplicationFormTypeSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFormTypes()
    {
        var formTypes = await applicationService.GetAllFormTypesAsync();
        return Ok(formTypes.Select(f => new ApplicationFormTypeSummaryResponse
        {
            Id = f.Id,
            Name = f.Name,
            Description = f.Description,
            IsPublic = f.IsPublic,
            QuestionCount = f.Questions.Count,
            CreatedAt = f.CreatedAt
        }).ToList());
    }

    [HttpGet("form-types/{id}")]
    [ProducesResponseType<ApplicationFormTypeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFormType(string id)
    {
        var formTypes = await applicationService.GetAllFormTypesAsync();
        var formType = formTypes.FirstOrDefault(f => f.Id == id);
        if (formType is null) return NotFound();

        return Ok(new ApplicationFormTypeResponse
        {
            Id = formType.Id,
            Name = formType.Name,
            Description = formType.Description,
            IsPublic = formType.IsPublic,
            Questions = formType.Questions
                .OrderBy(q => q.SortOrder)
                .Select(q => new ApplicationQuestionResponse { Id = q.Id, Text = q.Text, SortOrder = q.SortOrder })
                .ToList(),
            CreatedAt = formType.CreatedAt,
            UpdatedAt = formType.UpdatedAt
        });
    }

    [HttpPost("form-types")]
    [ProducesResponseType<ApplicationFormTypeSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateFormType([FromBody] CreateApplicationFormTypeRequest request)
    {
        var formType = await applicationService.CreateFormTypeAsync(request);
        return StatusCode(201, new ApplicationFormTypeSummaryResponse
        {
            Id = formType.Id,
            Name = formType.Name,
            Description = formType.Description,
            IsPublic = formType.IsPublic,
            QuestionCount = formType.Questions.Count,
            CreatedAt = formType.CreatedAt
        });
    }

    [HttpPut("form-types/{id}")]
    [ProducesResponseType<ApplicationFormTypeSummaryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateFormType(string id, [FromBody] CreateApplicationFormTypeRequest request)
    {
        var formType = await applicationService.UpdateFormTypeAsync(id, request);
        if (formType is null) return NotFound();

        return Ok(new ApplicationFormTypeSummaryResponse
        {
            Id = formType.Id,
            Name = formType.Name,
            Description = formType.Description,
            IsPublic = formType.IsPublic,
            QuestionCount = formType.Questions.Count,
            CreatedAt = formType.CreatedAt
        });
    }

    // ── Submissions ───────────────────────────────────────────────────────────

    [HttpGet]
    [ProducesResponseType<PaginatedResponse<ApplicationSubmissionSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSubmissions(
        [FromQuery] string? formTypeId,
        [FromQuery] string? state,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var result = await applicationService.GetSubmissionsAdminAsync(formTypeId, state, page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id}")]
    [ProducesResponseType<ApplicationSubmissionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSubmission(string id)
    {
        var submission = await applicationService.GetSubmissionAsync(id, GetAdminUserId(), true);
        if (submission is null) return NotFound();
        return Ok(submission);
    }

    [HttpPost("{id}/start-review")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartReview(string id)
    {
        var (success, error) = await applicationService.StartReviewAsync(id, GetAdminUserId(), GetAdminDiscordUsername());
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }

    [HttpPost("{id}/accept")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Accept(string id)
    {
        var (success, error) = await applicationService.AcceptAsync(id, GetAdminUserId(), GetAdminDiscordUsername());
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }

    [HttpPost("{id}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reject(string id, [FromBody] RejectSubmissionRequest request)
    {
        var (success, error) = await applicationService.RejectAsync(id, GetAdminUserId(), GetAdminDiscordUsername(), request.Remarks);
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }

    [HttpPost("{id}/lockout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LockOut(string id)
    {
        var (success, error) = await applicationService.LockOutAsync(id, GetAdminUserId(), GetAdminDiscordUsername());
        if (!success)
            return error == "Not found." ? NotFound() : BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }

    [HttpPost("assign")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignForm([FromBody] AssignFormRequest request)
    {
        var (success, error) = await applicationService.AssignFormAsync(
            request.FormTypeId, request.UserSlug,
            GetAdminUserId(), GetAdminDiscordUsername(),
            request.LockedOut);

        if (!success) return BadRequest(new ErrorResponse { Error = error! });
        return NoContent();
    }
}
