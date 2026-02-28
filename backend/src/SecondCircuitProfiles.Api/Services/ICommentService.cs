using SecondCircuitProfiles.Api.DTOs;

namespace SecondCircuitProfiles.Api.Services;

public interface ICommentService
{
    Task<List<CommentResponse>> GetComments(string thoughtId, string? requestingUserId);
    Task<(CommentResponse? comment, string? error)> CreateComment(string thoughtId, string userId, CommentCreateRequest request);
    Task<bool> DeleteComment(string commentId, string userId, bool isAdmin);
}
