namespace SecondCircuitProfiles.Api.Services;

public record GamePlayerResult(string UserId, string Username, string? DisplayName, string? UserSlug, bool IsWinner);

public record GameStatsEntryDto(
    string UserId,
    string Username,
    string? UserSlug,
    int GamesPlayed,
    int GamesWon,
    int GamesPlayedWithBots,
    int GamesWonWithBots);

public interface IGameStatsService
{
    Task RecordGameAsync(string gameType, IEnumerable<GamePlayerResult> players, bool hadBots);
    Task<List<GameStatsEntryDto>> GetLeaderboardAsync(string gameType, int limit = 20);
}
