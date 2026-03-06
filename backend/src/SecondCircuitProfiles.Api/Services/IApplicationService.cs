using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface IApplicationService
{
    // Form type management (admin)
    Task<ApplicationFormType> CreateFormTypeAsync(CreateApplicationFormTypeRequest request);
    Task<ApplicationFormType?> UpdateFormTypeAsync(string id, CreateApplicationFormTypeRequest request);
    Task<List<ApplicationFormType>> GetAllFormTypesAsync();

    // User: browse available forms and start/view submissions
    Task<List<AvailableFormResponse>> GetAvailableFormsAsync(string userId);
    Task<List<ApplicationSubmissionSummaryResponse>> GetMySubmissionsAsync(string userId);
    Task<ApplicationSubmissionResponse?> GetSubmissionAsync(string submissionId, string userId, bool isAdmin);
    Task<ApplicationSubmission?> StartSubmissionAsync(string formTypeId, string userId);
    Task<(bool Success, string? Error)> SaveAnswersAsync(string submissionId, string userId, List<ApplicationAnswerRequest> answers);
    Task<(bool Success, string? Error)> SubmitAsync(string submissionId, string userId);
    Task<(bool Success, string? Error)> RetractAsync(string submissionId, string userId);

    // Admin: review and manage submissions
    Task<PaginatedResponse<ApplicationSubmissionSummaryResponse>> GetSubmissionsAdminAsync(string? formTypeId, string? state, int page, int pageSize);
    Task<(bool Success, string? Error)> StartReviewAsync(string submissionId, string adminUserId, string adminDiscordUsername);
    Task<(bool Success, string? Error)> AcceptAsync(string submissionId, string adminUserId, string adminDiscordUsername);
    Task<(bool Success, string? Error)> RejectAsync(string submissionId, string adminUserId, string adminDiscordUsername, string? remarks);
    Task<(bool Success, string? Error)> LockOutAsync(string submissionId, string adminUserId, string adminDiscordUsername);
    Task<(bool Success, string? Error)> AssignFormAsync(string formTypeId, string targetUserSlug, string adminUserId, string adminDiscordUsername, bool lockedOut);
}
