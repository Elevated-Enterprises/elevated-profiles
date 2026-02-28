using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/users/{slug}/companions")]
[Produces("application/json")]
public class CompanionsController(
    IUserService userService,
    ICompanionService companionService,
    IImageService imageService,
    IAuditService auditService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<List<CompanionResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCompanions(string slug)
    {
        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var isAdmin = User.FindFirstValue("is_admin") == "true";
        var currentSlug = User.FindFirstValue("slug");
        var isOwner = currentSlug == slug;

        var companions = await companionService.GetByUserId(
            user.Id, isAuthenticated, isAdmin, isOwner);

        return Ok(companions.Select(MapToResponse));
    }

    [Authorize]
    [HttpPut("order")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderCompanions(string slug, [FromBody] CompanionReorderRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        if (currentSlug != slug)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        await companionService.ReorderAsync(user.Id, request.CompanionIds);
        return NoContent();
    }

    [HttpGet("{id}")]
    [ProducesResponseType<CompanionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCompanion(string slug, string id)
    {
        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var companion = await companionService.GetById(id);
        if (companion is null || companion.UserId != user.Id)
            return NotFound();

        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var isAdmin = User.FindFirstValue("is_admin") == "true";
        var currentSlug = User.FindFirstValue("slug");
        var isOwner = currentSlug == slug;

        if (!isAdmin && !isOwner)
        {
            if (companion.Visibility == Models.Visibility.Private)
                return NotFound();
            if (companion.Visibility == Models.Visibility.MembersOnly && !isAuthenticated)
                return NotFound();
        }

        return Ok(MapToResponse(companion));
    }

    [Authorize]
    [HttpPost]
    [ProducesResponseType<CompanionResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateCompanion(string slug, [FromBody] CompanionCreateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        if (currentSlug != slug)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var companion = await companionService.Create(user.Id, request);
        return CreatedAtAction(nameof(GetCompanion),
            new { slug, id = companion.Id },
            MapToResponse(companion));
    }

    [Authorize]
    [HttpPut("{id}")]
    [ProducesResponseType<CompanionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCompanion(string slug, string id,
        [FromBody] CompanionUpdateRequest request)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var companion = await companionService.GetById(id);
        if (companion is null || companion.UserId != user.Id)
            return NotFound();

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "UpdateCompanion",
                "Companion",
                id,
                details: $"User: {slug}",
                previousValues: new
                {
                    companion.Visibility,
                    companion.Name,
                    companion.Platform,
                    companion.Role,
                    companion.DateOfBirth,
                    companion.Bio,
                    companion.Alignment
                },
                newValues: request);
        }

        var updated = await companionService.Update(id, request);
        if (updated is null) return NotFound();

        return Ok(MapToResponse(updated));
    }

    [Authorize]
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCompanion(string slug, string id)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var companion = await companionService.GetById(id);
        if (companion is null || companion.UserId != user.Id)
            return NotFound();

        if (companion.ProfileImageFilename is not null)
            imageService.DeleteImage(companion.ProfileImageFilename);

        await companionService.Delete(id);

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "DeleteCompanion",
                "Companion",
                id,
                details: $"User: {slug}, Companion: {companion.Name}");
        }

        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/image")]
    [ProducesResponseType<ImageUploadResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadCompanionImage(string slug, string id, IFormFile file)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var companion = await companionService.GetById(id);
        if (companion is null || companion.UserId != user.Id)
            return NotFound();

        if (companion.ProfileImageFilename is not null)
            imageService.DeleteImage(companion.ProfileImageFilename);

        try
        {
            var filename = await imageService.SaveImage(file);
            await companionService.UpdateProfileImage(id, filename);

            if (isAdmin && currentSlug != slug)
            {
                await auditService.LogAction(
                    User.FindFirstValue("discord_id")!,
                    User.FindFirstValue("discord_username")!,
                    "UpdateCompanionImage",
                    "Companion",
                    id,
                    details: $"User: {slug}");
            }

            return Ok(new ImageUploadResponse { ProfileImageUrl = filename });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ErrorResponse { Error = ex.Message });
        }
    }

    [Authorize]
    [HttpDelete("{id}/image")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCompanionImage(string slug, string id)
    {
        var currentSlug = User.FindFirstValue("slug");
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        if (currentSlug != slug && !isAdmin)
            return Forbid();

        var user = await userService.GetBySlug(slug);
        if (user is null) return NotFound();

        var companion = await companionService.GetById(id);
        if (companion is null || companion.UserId != user.Id)
            return NotFound();

        if (companion.ProfileImageFilename is not null)
            imageService.DeleteImage(companion.ProfileImageFilename);

        await companionService.UpdateProfileImage(id, null);

        if (isAdmin && currentSlug != slug)
        {
            await auditService.LogAction(
                User.FindFirstValue("discord_id")!,
                User.FindFirstValue("discord_username")!,
                "DeleteCompanionImage",
                "Companion",
                id,
                details: $"User: {slug}");
        }

        return NoContent();
    }

    private static CompanionResponse MapToResponse(Models.Companion companion) => new()
    {
        Id = companion.Id,
        Visibility = companion.Visibility,
        ProfileImageUrl = companion.ProfileImageFilename,
        Name = companion.Name,
        Platform = companion.Platform,
        Role = companion.Role,
        DateOfBirth = companion.DateOfBirth,
        Bio = companion.Bio,
        Alignment = companion.Alignment,
        CreatedAt = companion.CreatedAt,
        UpdatedAt = companion.UpdatedAt
    };
}
