using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public record YahtzeeScoreCardDto(
    int? Ones, int? Twos, int? Threes, int? Fours, int? Fives, int? Sixes,
    int? ThreeOfAKind, int? FourOfAKind, int? FullHouse, int? SmallStraight,
    int? LargeStraight, int? Yahtzee, int? Chance,
    int YahtzeeBonusCount,
    int UpperTotal,
    int UpperBonus,
    int GrandTotal,
    bool IsComplete);

public record YahtzeeParticipantDto(
    string UserId,
    string Username,
    string? UserSlug,
    string? AvatarUrl,
    string Role,
    bool IsConnected,
    YahtzeeScoreCardDto ScoreCard);

public record YahtzeeGameSummaryDto(
    string Slug,
    string Name,
    string GmUsername,
    YahtzeeGameStatus Status,
    int PlayerCount,
    int WatcherCount,
    DateTime LastActivity);

public record YahtzeeGameStateDto(
    string Slug,
    string Name,
    string GmUserId,
    string GmUsername,
    YahtzeeGameStatus Status,
    List<YahtzeeParticipantDto> Participants,
    int[] CurrentDice,
    bool[] HeldDice,
    int RollCount,
    bool ScoredThisTurn,
    int CurrentPlayerIndex,
    bool PlayAgainVoteActive);

public interface IYahtzeeService
{
    Task<(YahtzeeGame game, string? error)> CreateGameAsync(
        string userId, string username, string? userSlug, string? avatarUrl, string? customName);

    Task<(YahtzeeGameStateDto? state, string? error)> HandleConnectionAsync(
        string? slug, string userId, string username, string? userSlug, string? avatarUrl,
        string connectionId, bool isListMode);

    Task HandleDisconnectionAsync(string? slug, string userId, string connectionId, bool isListMode);

    Task<List<YahtzeeGameSummaryDto>> GetOpenGamesAsync(int page, int pageSize);
    Task<int> GetOpenGamesCountAsync();

    Task StartGameAsync(string slug, string userId);
    Task CancelGameAsync(string slug, string userId);
    Task RollDiceAsync(string slug, string userId);
    Task ToggleHoldAsync(string slug, string userId, int diceIndex);
    Task SelectScoreAsync(string slug, string userId, string category);
    Task VotePlayAgainAsync(string slug, string userId, bool vote);
    Task InitiatePlayAgainAsync(string slug, string userId);

    Task CleanupAbandonedGamesAsync();
}
