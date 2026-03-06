using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class ApplicationService(
    MongoDbContext db,
    IUserService userService,
    INotificationService notificationService) : IApplicationService
{
    // ── Form type management ──────────────────────────────────────────────────

    public async Task<ApplicationFormType> CreateFormTypeAsync(CreateApplicationFormTypeRequest request)
    {
        var formType = new ApplicationFormType
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsPublic = request.IsPublic,
            Questions = request.Questions
                .OrderBy(q => q.SortOrder)
                .Select((q, i) => new ApplicationQuestion
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Text = q.Text.Trim(),
                    SortOrder = i
                })
                .ToList(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await db.ApplicationFormTypes.InsertOneAsync(formType);
        return formType;
    }

    public async Task<ApplicationFormType?> UpdateFormTypeAsync(string id, CreateApplicationFormTypeRequest request)
    {
        var existing = await db.ApplicationFormTypes.Find(f => f.Id == id).FirstOrDefaultAsync();
        if (existing is null) return null;

        // Preserve IDs of existing questions where text matches, assign new IDs to new questions
        var updatedQuestions = request.Questions
            .OrderBy(q => q.SortOrder)
            .Select((q, i) =>
            {
                var existingQ = existing.Questions.FirstOrDefault(eq => eq.Text.Trim() == q.Text.Trim());
                return new ApplicationQuestion
                {
                    Id = existingQ?.Id ?? Guid.NewGuid().ToString("N"),
                    Text = q.Text.Trim(),
                    SortOrder = i
                };
            })
            .ToList();

        var update = Builders<ApplicationFormType>.Update
            .Set(f => f.Name, request.Name.Trim())
            .Set(f => f.Description, request.Description?.Trim())
            .Set(f => f.IsPublic, request.IsPublic)
            .Set(f => f.Questions, updatedQuestions)
            .Set(f => f.UpdatedAt, DateTime.UtcNow);

        await db.ApplicationFormTypes.UpdateOneAsync(f => f.Id == id, update);
        return await db.ApplicationFormTypes.Find(f => f.Id == id).FirstOrDefaultAsync();
    }

    public async Task<List<ApplicationFormType>> GetAllFormTypesAsync()
    {
        return await db.ApplicationFormTypes
            .Find(_ => true)
            .SortBy(f => f.Name)
            .ToListAsync();
    }

    // ── User operations ───────────────────────────────────────────────────────

    public async Task<List<AvailableFormResponse>> GetAvailableFormsAsync(string userId)
    {
        // Get all submissions for this user
        var mySubmissions = await db.ApplicationSubmissions
            .Find(s => s.UserId == userId)
            .ToListAsync();

        var mySubmissionsByFormType = mySubmissions.ToDictionary(s => s.FormTypeId);

        // Public form types the user is not locked out of
        var publicFormTypes = await db.ApplicationFormTypes
            .Find(f => f.IsPublic)
            .SortBy(f => f.Name)
            .ToListAsync();

        // Non-public form types where user has an assigned submission (that is not locked out)
        var assignedFormTypeIds = mySubmissions
            .Where(s => !s.FormTypeId.Equals("") && s.AssignedByUserId != null)
            .Select(s => s.FormTypeId)
            .Distinct()
            .ToList();

        var assignedFormTypes = assignedFormTypeIds.Count > 0
            ? await db.ApplicationFormTypes
                .Find(Builders<ApplicationFormType>.Filter.In(f => f.Id, assignedFormTypeIds))
                .ToListAsync()
            : [];

        var allRelevantFormTypes = publicFormTypes
            .Concat(assignedFormTypes.Where(af => publicFormTypes.All(pf => pf.Id != af.Id)))
            .ToList();

        var result = new List<AvailableFormResponse>();

        foreach (var formType in allRelevantFormTypes)
        {
            mySubmissionsByFormType.TryGetValue(formType.Id, out var submission);

            // Hide forms where user is locked out
            if (submission?.State == ApplicationSubmissionState.LockedOut)
                continue;

            result.Add(new AvailableFormResponse
            {
                FormType = MapFormTypeSummary(formType),
                MySubmission = submission is not null ? MapSubmissionSummary(submission, formType.Name) : null
            });
        }

        return result;
    }

    public async Task<List<ApplicationSubmissionSummaryResponse>> GetMySubmissionsAsync(string userId)
    {
        var submissions = await db.ApplicationSubmissions
            .Find(s => s.UserId == userId && s.State != ApplicationSubmissionState.LockedOut)
            .SortByDescending(s => s.UpdatedAt)
            .ToListAsync();

        var formTypeIds = submissions.Select(s => s.FormTypeId).Distinct().ToList();
        var formTypes = formTypeIds.Count > 0
            ? await db.ApplicationFormTypes
                .Find(Builders<ApplicationFormType>.Filter.In(f => f.Id, formTypeIds))
                .ToListAsync()
            : [];
        var formTypeMap = formTypes.ToDictionary(f => f.Id);

        return submissions
            .Where(s => formTypeMap.ContainsKey(s.FormTypeId))
            .Select(s => MapSubmissionSummary(s, formTypeMap[s.FormTypeId].Name))
            .ToList();
    }

    public async Task<ApplicationSubmissionResponse?> GetSubmissionAsync(string submissionId, string userId, bool isAdmin)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return null;
        if (!isAdmin && submission.UserId != userId) return null;
        // Users cannot see locked-out submissions
        if (!isAdmin && submission.State == ApplicationSubmissionState.LockedOut) return null;

        var formType = await db.ApplicationFormTypes.Find(f => f.Id == submission.FormTypeId).FirstOrDefaultAsync();
        if (formType is null) return null;

        var history = await db.ApplicationSubmissionHistory
            .Find(h => h.SubmissionId == submissionId)
            .SortByDescending(h => h.ChangedAt)
            .ToListAsync();

        User? user = null;
        if (isAdmin)
            user = await userService.GetById(submission.UserId);

        return MapSubmissionFull(submission, formType, history, user);
    }

    public async Task<ApplicationSubmission?> StartSubmissionAsync(string formTypeId, string userId)
    {
        // Check if submission already exists
        var existing = await db.ApplicationSubmissions
            .Find(s => s.UserId == userId && s.FormTypeId == formTypeId)
            .FirstOrDefaultAsync();
        if (existing is not null) return existing;

        var formType = await db.ApplicationFormTypes.Find(f => f.Id == formTypeId).FirstOrDefaultAsync();
        if (formType is null) return null;
        // Only allow starting public forms this way; private forms are assigned by admin
        if (!formType.IsPublic) return null;

        var submission = new ApplicationSubmission
        {
            UserId = userId,
            FormTypeId = formTypeId,
            State = ApplicationSubmissionState.Incomplete,
            Answers = formType.Questions.Select(q => new ApplicationAnswer { QuestionId = q.Id, Text = "" }).ToList(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await db.ApplicationSubmissions.InsertOneAsync(submission);
        await RecordHistory(submission.Id, userId, null, ApplicationSubmissionState.Incomplete, userId, "system");
        return submission;
    }

    public async Task<(bool Success, string? Error)> SaveAnswersAsync(string submissionId, string userId, List<ApplicationAnswerRequest> answers)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.UserId != userId) return (false, "Forbidden.");
        if (submission.State != ApplicationSubmissionState.Incomplete)
            return (false, "Answers can only be edited when the form is incomplete.");

        // Validate answer length
        if (answers.Any(a => (a.Text ?? "").Length > 2000))
            return (false, "Answers may not exceed 2000 characters.");

        var updatedAnswers = answers.Select(a => new ApplicationAnswer
        {
            QuestionId = a.QuestionId,
            Text = (a.Text ?? "").Trim()
        }).ToList();

        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.Answers, updatedAnswers)
                .Set(s => s.UpdatedAt, DateTime.UtcNow));

        return (true, null);
    }

    public async Task<(bool Success, string? Error)> SubmitAsync(string submissionId, string userId)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.UserId != userId) return (false, "Forbidden.");
        if (submission.State != ApplicationSubmissionState.Incomplete)
            return (false, "Only incomplete applications can be submitted.");

        var now = DateTime.UtcNow;
        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.State, ApplicationSubmissionState.Submitted)
                .Set(s => s.SubmittedAt, now)
                .Set(s => s.UpdatedAt, now));

        await RecordHistory(submissionId, userId, ApplicationSubmissionState.Incomplete, ApplicationSubmissionState.Submitted, userId, "self");
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> RetractAsync(string submissionId, string userId)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.UserId != userId) return (false, "Forbidden.");

        if (submission.State != ApplicationSubmissionState.Submitted && submission.State != ApplicationSubmissionState.Rejected)
            return (false, "This application cannot be retracted in its current state.");

        var fromState = submission.State;
        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.State, ApplicationSubmissionState.Incomplete)
                .Set(s => s.AdminRemarks, (string?)null)
                .Set(s => s.UpdatedAt, DateTime.UtcNow));

        await RecordHistory(submissionId, userId, fromState, ApplicationSubmissionState.Incomplete, userId, "self");
        return (true, null);
    }

    // ── Admin operations ──────────────────────────────────────────────────────

    public async Task<PaginatedResponse<ApplicationSubmissionSummaryResponse>> GetSubmissionsAdminAsync(
        string? formTypeId, string? state, int page, int pageSize)
    {
        var filterBuilder = Builders<ApplicationSubmission>.Filter;
        var filter = filterBuilder.Empty;

        if (!string.IsNullOrEmpty(formTypeId))
            filter &= filterBuilder.Eq(s => s.FormTypeId, formTypeId);

        if (!string.IsNullOrEmpty(state) && Enum.TryParse<ApplicationSubmissionState>(state, true, out var parsedState))
            filter &= filterBuilder.Eq(s => s.State, parsedState);

        var total = (int)await db.ApplicationSubmissions.CountDocumentsAsync(filter);
        var submissions = await db.ApplicationSubmissions
            .Find(filter)
            .SortByDescending(s => s.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var formTypeIds = submissions.Select(s => s.FormTypeId).Distinct().ToList();
        var formTypes = formTypeIds.Count > 0
            ? await db.ApplicationFormTypes
                .Find(Builders<ApplicationFormType>.Filter.In(f => f.Id, formTypeIds))
                .ToListAsync()
            : [];
        var formTypeMap = formTypes.ToDictionary(f => f.Id);

        var userIds = submissions.Select(s => s.UserId).Distinct().ToList();
        var users = userIds.Count > 0 ? await userService.GetByIds(userIds) : [];
        var userMap = users.ToDictionary(u => u.Id);

        var items = submissions.Select(s =>
        {
            var summary = MapSubmissionSummary(s, formTypeMap.TryGetValue(s.FormTypeId, out var ft) ? ft.Name : "Unknown");
            if (userMap.TryGetValue(s.UserId, out var user))
            {
                summary.UserDisplayName = user.AlternativeName ?? user.DiscordUsername;
                summary.UserSlug = user.Slug;
                summary.UserDiscordUsername = user.DiscordUsername;
            }
            return summary;
        }).ToList();

        return new PaginatedResponse<ApplicationSubmissionSummaryResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total,
            TotalPages = (int)Math.Ceiling((double)total / pageSize)
        };
    }

    public async Task<(bool Success, string? Error)> StartReviewAsync(string submissionId, string adminUserId, string adminDiscordUsername)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.State != ApplicationSubmissionState.Submitted)
            return (false, "Only submitted applications can be moved to review.");

        var now = DateTime.UtcNow;
        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.State, ApplicationSubmissionState.InReview)
                .Set(s => s.ReviewStartedAt, now)
                .Set(s => s.UpdatedAt, now));

        await RecordHistory(submissionId, submission.UserId, ApplicationSubmissionState.Submitted, ApplicationSubmissionState.InReview, adminUserId, adminDiscordUsername);
        await NotifyUser(submission.UserId, submission.Id, "InReview");
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> AcceptAsync(string submissionId, string adminUserId, string adminDiscordUsername)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.State != ApplicationSubmissionState.InReview)
            return (false, "Only applications in review can be accepted.");

        var now = DateTime.UtcNow;
        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.State, ApplicationSubmissionState.Accepted)
                .Set(s => s.ResolvedAt, now)
                .Set(s => s.UpdatedAt, now));

        await RecordHistory(submissionId, submission.UserId, ApplicationSubmissionState.InReview, ApplicationSubmissionState.Accepted, adminUserId, adminDiscordUsername);
        await NotifyUser(submission.UserId, submission.Id, "Accepted");
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> RejectAsync(string submissionId, string adminUserId, string adminDiscordUsername, string? remarks)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.State != ApplicationSubmissionState.InReview && submission.State != ApplicationSubmissionState.LockedOut)
            return (false, "Only applications in review or locked out can be rejected.");

        var fromState = submission.State;
        var now = DateTime.UtcNow;
        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.State, ApplicationSubmissionState.Rejected)
                .Set(s => s.AdminRemarks, remarks?.Trim())
                .Set(s => s.ResolvedAt, now)
                .Set(s => s.UpdatedAt, now));

        await RecordHistory(submissionId, submission.UserId, fromState, ApplicationSubmissionState.Rejected, adminUserId, adminDiscordUsername, remarks);
        await NotifyUser(submission.UserId, submission.Id, "Rejected");
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> LockOutAsync(string submissionId, string adminUserId, string adminDiscordUsername)
    {
        var submission = await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync();
        if (submission is null) return (false, "Not found.");
        if (submission.State == ApplicationSubmissionState.Accepted)
            return (false, "Accepted applications cannot be locked out.");

        var fromState = submission.State;
        await db.ApplicationSubmissions.UpdateOneAsync(
            s => s.Id == submissionId,
            Builders<ApplicationSubmission>.Update
                .Set(s => s.State, ApplicationSubmissionState.LockedOut)
                .Set(s => s.UpdatedAt, DateTime.UtcNow));

        await RecordHistory(submissionId, submission.UserId, fromState, ApplicationSubmissionState.LockedOut, adminUserId, adminDiscordUsername);
        return (true, null);
    }

    public async Task<(bool Success, string? Error)> AssignFormAsync(
        string formTypeId, string targetUserSlug, string adminUserId, string adminDiscordUsername, bool lockedOut)
    {
        var formType = await db.ApplicationFormTypes.Find(f => f.Id == formTypeId).FirstOrDefaultAsync();
        if (formType is null) return (false, "Form type not found.");

        var targetUser = await userService.GetBySlug(targetUserSlug);
        if (targetUser is null) return (false, "User not found.");

        // Check if submission already exists
        var existing = await db.ApplicationSubmissions
            .Find(s => s.UserId == targetUser.Id && s.FormTypeId == formTypeId)
            .FirstOrDefaultAsync();
        if (existing is not null) return (false, "This form is already assigned to that user.");

        var state = lockedOut ? ApplicationSubmissionState.LockedOut : ApplicationSubmissionState.Incomplete;
        var submission = new ApplicationSubmission
        {
            UserId = targetUser.Id,
            FormTypeId = formTypeId,
            State = state,
            AssignedByUserId = adminUserId,
            Answers = formType.Questions.Select(q => new ApplicationAnswer { QuestionId = q.Id, Text = "" }).ToList(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await db.ApplicationSubmissions.InsertOneAsync(submission);
        await RecordHistory(submission.Id, targetUser.Id, null, state, adminUserId, adminDiscordUsername);

        if (!lockedOut)
            await notificationService.CreateAsync(
                targetUser.Id,
                "application_assigned",
                "New application form assigned",
                $"You have been assigned a new application form: \"{formType.Name}\".",
                submission.Id);

        return (true, null);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task RecordHistory(string submissionId, string userId,
        ApplicationSubmissionState? fromState, ApplicationSubmissionState toState,
        string changedByUserId, string changedByDiscordUsername, string? remarks = null)
    {
        var entry = new ApplicationSubmissionHistory
        {
            SubmissionId = submissionId,
            UserId = userId,
            FromState = fromState,
            ToState = toState,
            ChangedByUserId = changedByUserId,
            ChangedByDiscordUsername = changedByDiscordUsername,
            Remarks = remarks,
            ChangedAt = DateTime.UtcNow
        };
        await db.ApplicationSubmissionHistory.InsertOneAsync(entry);
    }

    private async Task NotifyUser(string userId, string submissionId, string newState)
    {
        var formType = (await db.ApplicationSubmissions.Find(s => s.Id == submissionId).FirstOrDefaultAsync())
            is { } sub
            ? await db.ApplicationFormTypes.Find(f => f.Id == sub.FormTypeId).FirstOrDefaultAsync()
            : null;
        var formName = formType?.Name ?? "your application";

        var (title, body) = newState switch
        {
            "InReview" => ("Application under review", $"Your application \"{formName}\" is now being reviewed."),
            "Accepted" => ("Application accepted", $"Congratulations! Your application \"{formName}\" has been accepted."),
            "Rejected" => ("Application not accepted", $"Your application \"{formName}\" was not accepted. You may review the feedback and resubmit."),
            _ => ("Application update", $"Your application \"{formName}\" has been updated.")
        };

        await notificationService.CreateAsync(userId, $"application_{newState.ToLower()}", title, body, submissionId);
    }

    private static ApplicationFormTypeSummaryResponse MapFormTypeSummary(ApplicationFormType f) => new()
    {
        Id = f.Id,
        Name = f.Name,
        Description = f.Description,
        IsPublic = f.IsPublic,
        QuestionCount = f.Questions.Count,
        CreatedAt = f.CreatedAt
    };

    private static ApplicationSubmissionSummaryResponse MapSubmissionSummary(ApplicationSubmission s, string formTypeName) => new()
    {
        Id = s.Id,
        FormTypeId = s.FormTypeId,
        FormTypeName = formTypeName,
        State = s.State.ToString(),
        AdminRemarks = s.AdminRemarks,
        CreatedAt = s.CreatedAt,
        SubmittedAt = s.SubmittedAt,
        ResolvedAt = s.ResolvedAt
    };

    private static ApplicationSubmissionResponse MapSubmissionFull(
        ApplicationSubmission s, ApplicationFormType formType,
        List<ApplicationSubmissionHistory> history, User? user) => new()
    {
        Id = s.Id,
        UserId = s.UserId,
        FormTypeId = s.FormTypeId,
        FormTypeName = formType.Name,
        FormTypeDescription = formType.Description,
        Questions = formType.Questions
            .OrderBy(q => q.SortOrder)
            .Select(q => new ApplicationQuestionResponse { Id = q.Id, Text = q.Text, SortOrder = q.SortOrder })
            .ToList(),
        State = s.State.ToString(),
        Answers = s.Answers.Select(a => new ApplicationAnswerResponse { QuestionId = a.QuestionId, Text = a.Text }).ToList(),
        AdminRemarks = s.AdminRemarks,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt,
        SubmittedAt = s.SubmittedAt,
        ReviewStartedAt = s.ReviewStartedAt,
        ResolvedAt = s.ResolvedAt,
        UserDisplayName = user is not null ? user.AlternativeName ?? user.DiscordUsername : null,
        UserSlug = user?.Slug,
        UserDiscordUsername = user?.DiscordUsername,
        History = history.Select(h => new ApplicationSubmissionHistoryResponse
        {
            Id = h.Id,
            FromState = h.FromState?.ToString(),
            ToState = h.ToState.ToString(),
            ChangedByDiscordUsername = h.ChangedByDiscordUsername,
            Remarks = h.Remarks,
            ChangedAt = h.ChangedAt
        }).ToList()
    };
}
