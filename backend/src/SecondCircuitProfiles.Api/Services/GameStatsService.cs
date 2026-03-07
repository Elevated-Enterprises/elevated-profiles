using MongoDB.Driver;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class GameStatsService(MongoDbContext db) : IGameStatsService
{
    public async Task RecordGameAsync(string gameType, IEnumerable<GamePlayerResult> players, bool hadBots)
    {
        var playerList = players.ToList();
        if (playerList.Count == 0) return;

        var tasks = playerList.Select(p =>
        {
            var filter = Builders<GameStats>.Filter.And(
                Builders<GameStats>.Filter.Eq(s => s.UserId, p.UserId),
                Builders<GameStats>.Filter.Eq(s => s.GameType, gameType));

            var update = Builders<GameStats>.Update
                .Set(s => s.Username, p.DisplayName ?? p.Username)
                .Set(s => s.UserSlug, p.UserSlug)
                .Inc(s => s.GamesPlayed, hadBots ? 0 : 1)
                .Inc(s => s.GamesWon, !hadBots && p.IsWinner ? 1 : 0)
                .Inc(s => s.GamesPlayedWithBots, hadBots ? 1 : 0)
                .Inc(s => s.GamesWonWithBots, hadBots && p.IsWinner ? 1 : 0);

            return db.GameStats.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
        });

        await Task.WhenAll(tasks);
    }

    public async Task<List<GameStatsEntryDto>> GetLeaderboardAsync(string gameType, int limit = 20)
    {
        var entries = await db.GameStats
            .Find(s => s.GameType == gameType)
            .SortByDescending(s => s.GamesWon)
            .Limit(limit)
            .ToListAsync();

        return entries.Select(e => new GameStatsEntryDto(
            e.UserId, e.Username, e.UserSlug,
            e.GamesPlayed, e.GamesWon,
            e.GamesPlayedWithBots, e.GamesWonWithBots))
            .ToList();
    }
}
