using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class StatusService(MongoDbContext db, IFeedService feedService) : IStatusService
{
    public async Task<StatusUpdateResponse> SetStatus(string userId, string text)
    {
        var status = new StatusUpdate
        {
            UserId = userId,
            Text = text.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.StatusUpdates.InsertOneAsync(status);

        await feedService.RecordStatusChange(userId, text);

        return Map(status);
    }

    public async Task<StatusUpdateResponse?> GetLatestStatus(string userId)
    {
        var status = await db.StatusUpdates
            .Find(s => s.UserId == userId)
            .SortByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        return status == null ? null : Map(status);
    }

    public async Task<Dictionary<string, string>> GetLatestStatuses(List<string> userIds)
    {
        if (userIds.Count == 0) return new Dictionary<string, string>();

        var statuses = await db.StatusUpdates
            .Find(s => userIds.Contains(s.UserId))
            .SortByDescending(s => s.CreatedAt)
            .ToListAsync();

        // Keep only the latest per user
        return statuses
            .GroupBy(s => s.UserId)
            .ToDictionary(g => g.Key, g => g.First().Text);
    }

    private static StatusUpdateResponse Map(StatusUpdate s) => new()
    {
        Id = s.Id,
        UserId = s.UserId,
        Text = s.Text,
        CreatedAt = s.CreatedAt
    };
}
