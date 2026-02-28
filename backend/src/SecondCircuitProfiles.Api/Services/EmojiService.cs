using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class EmojiService(MongoDbContext db) : IEmojiService
{
    public async Task<List<AvailableEmojiResponse>> GetAll(bool activeOnly = false)
    {
        var filter = activeOnly
            ? Builders<AvailableEmoji>.Filter.Eq(e => e.IsActive, true)
            : Builders<AvailableEmoji>.Filter.Empty;

        var emojis = await db.AvailableEmojis
            .Find(filter)
            .SortBy(e => e.SortOrder)
            .ToListAsync();

        return emojis.Select(Map).ToList();
    }

    public async Task<AvailableEmojiResponse> Create(AvailableEmojiCreateRequest request)
    {
        var emoji = new AvailableEmoji
        {
            Key = request.Key.Trim().ToLower(),
            Emoji = request.Emoji.Trim(),
            Label = request.Label.Trim(),
            SortOrder = request.SortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        await db.AvailableEmojis.InsertOneAsync(emoji);
        return Map(emoji);
    }

    public async Task<AvailableEmojiResponse?> ToggleActive(string id)
    {
        var emoji = await db.AvailableEmojis.Find(e => e.Id == id).FirstOrDefaultAsync();
        if (emoji == null) return null;

        var update = Builders<AvailableEmoji>.Update.Set(e => e.IsActive, !emoji.IsActive);
        await db.AvailableEmojis.UpdateOneAsync(e => e.Id == id, update);
        emoji.IsActive = !emoji.IsActive;
        return Map(emoji);
    }

    public async Task<AvailableEmoji?> GetByKey(string key)
    {
        return await db.AvailableEmojis.Find(e => e.Key == key).FirstOrDefaultAsync();
    }

    private static AvailableEmojiResponse Map(AvailableEmoji e) => new()
    {
        Id = e.Id,
        Key = e.Key,
        Emoji = e.Emoji,
        Label = e.Label,
        IsActive = e.IsActive,
        SortOrder = e.SortOrder
    };
}
