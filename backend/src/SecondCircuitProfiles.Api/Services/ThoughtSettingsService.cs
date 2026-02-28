using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class ThoughtSettingsService(MongoDbContext db) : IThoughtSettingsService
{
    private async Task<ThoughtSettings> GetOrCreate()
    {
        var settings = await db.ThoughtSettings.Find(_ => true).FirstOrDefaultAsync();
        if (settings != null) return settings;

        settings = new ThoughtSettings();
        await db.ThoughtSettings.InsertOneAsync(settings);
        return settings;
    }

    public async Task<ThoughtSettingsResponse> GetSettings()
    {
        var s = await GetOrCreate();
        return Map(s);
    }

    public async Task<ThoughtSettingsResponse> UpdateSettings(ThoughtSettingsUpdateRequest request)
    {
        var s = await GetOrCreate();

        var update = Builders<ThoughtSettings>.Update.Combine();
        if (request.MaxThoughtsPerWindow.HasValue)
            update = update.Set(x => x.MaxThoughtsPerWindow, request.MaxThoughtsPerWindow.Value);
        if (request.RateLimitWindowHours.HasValue)
            update = update.Set(x => x.RateLimitWindowHours, request.RateLimitWindowHours.Value);
        if (request.MinThoughtLength.HasValue)
            update = update.Set(x => x.MinThoughtLength, request.MinThoughtLength.Value);
        if (request.MinCommentLength.HasValue)
            update = update.Set(x => x.MinCommentLength, request.MinCommentLength.Value);

        await db.ThoughtSettings.UpdateOneAsync(x => x.Id == s.Id, update);
        return await GetSettings();
    }

    public async Task<ThoughtSettingsResponse> SetUserOverride(string userId, ThoughtUserOverrideRequest request)
    {
        var s = await GetOrCreate();

        if (request.Reset)
        {
            var removeUpdate = Builders<ThoughtSettings>.Update.Unset($"userOverrides.{userId}");
            await db.ThoughtSettings.UpdateOneAsync(x => x.Id == s.Id, removeUpdate);
        }
        else
        {
            var overrideObj = new ThoughtSettingsOverride
            {
                MaxThoughtsPerWindow = request.MaxThoughtsPerWindow,
                RateLimitWindowHours = request.RateLimitWindowHours,
                MinThoughtLength = request.MinThoughtLength,
                MinCommentLength = request.MinCommentLength
            };
            var setUpdate = Builders<ThoughtSettings>.Update.Set($"userOverrides.{userId}", overrideObj);
            await db.ThoughtSettings.UpdateOneAsync(x => x.Id == s.Id, setUpdate);
        }

        return await GetSettings();
    }

    public async Task<(int maxPerWindow, int windowHours, int minThoughtLength, int minCommentLength)> GetEffectiveSettings(string userId)
    {
        var s = await GetOrCreate();
        s.UserOverrides.TryGetValue(userId, out var ov);

        return (
            ov?.MaxThoughtsPerWindow ?? s.MaxThoughtsPerWindow,
            ov?.RateLimitWindowHours ?? s.RateLimitWindowHours,
            ov?.MinThoughtLength ?? s.MinThoughtLength,
            ov?.MinCommentLength ?? s.MinCommentLength
        );
    }

    private static ThoughtSettingsResponse Map(ThoughtSettings s) => new()
    {
        MaxThoughtsPerWindow = s.MaxThoughtsPerWindow,
        RateLimitWindowHours = s.RateLimitWindowHours,
        MinThoughtLength = s.MinThoughtLength,
        MinCommentLength = s.MinCommentLength,
        UserOverrides = s.UserOverrides
    };
}
