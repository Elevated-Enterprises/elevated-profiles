using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public record PigParticipantDto(
    string UserId,
    string Username,
    string? UserSlug,
    string? AvatarUrl,
    string Role,
    int Score,
    int ConsecutiveSkips,
    bool IsConnected);

public record PigGameSummary(
    string Slug,
    string Name,
    string GmUsername,
    PigGameStatus Status,
    int PlayerCount,
    int WatcherCount,
    DateTime LastActivity);

public record PigGameStateSnapshot(
    string Slug,
    string Name,
    string GmUserId,
    string GmUsername,
    PigGameStatus Status,
    List<PigParticipantDto> Participants,
    List<string> TurnOrder,
    int CurrentPlayerIndex,
    int CurrentTurnScore,
    bool PlayAgainVoteActive);

public interface IPigService
{
    Task<(PigGame game, string? error)> CreateGameAsync(
        string userId, string username, string? userSlug, string? avatarUrl, string? customName);

    Task<List<PigGameSummary>> GetOpenGamesAsync(int page, int pageSize);
    Task<int> GetOpenGamesCountAsync();

    Task<(PigGameStateSnapshot? state, string? error)> HandleConnectionAsync(
        string slug, string userId, string username, string? userSlug, string? avatarUrl, string connectionId, bool isListMode);

    Task HandleDisconnectionAsync(string? slug, string userId, string connectionId, bool isListMode);

    Task RollAsync(string slug, string userId);
    Task HoldAsync(string slug, string userId);
    Task StartGameAsync(string slug, string userId);
    Task CancelGameAsync(string slug, string userId);
    Task KickPlayerAsync(string slug, string gmUserId, string targetUserId);
    Task LeaveGameAsync(string slug, string userId, string connectionId);
    Task PlayAgainVoteAsync(string slug, string userId, bool vote);
    Task InitiatePlayAgainAsync(string slug, string userId);
    Task SendChatAsync(string slug, string userId, string username, string role, string text);
    Task CleanupAbandonedGamesAsync();
}
