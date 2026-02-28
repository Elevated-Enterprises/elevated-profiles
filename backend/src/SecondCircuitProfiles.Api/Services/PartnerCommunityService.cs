using MongoDB.Driver;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class PartnerCommunityService(MongoDbContext db) : IPartnerCommunityService
{
    public async Task<List<PartnerCommunity>> GetAll()
    {
        return await db.PartnerCommunities.Find(_ => true)
            .SortBy(p => p.Name)
            .ToListAsync();
    }

    public async Task<PartnerCommunity?> GetById(string id)
    {
        return await db.PartnerCommunities.Find(p => p.Id == id).FirstOrDefaultAsync();
    }

    public async Task<PartnerCommunity> Create(string name, string discordInviteUrl)
    {
        var community = new PartnerCommunity
        {
            Name = name.Trim(),
            DiscordInviteUrl = discordInviteUrl.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.PartnerCommunities.InsertOneAsync(community);
        return community;
    }

    public async Task<bool> Delete(string id)
    {
        var result = await db.PartnerCommunities.DeleteOneAsync(p => p.Id == id);
        if (result.DeletedCount == 0) return false;

        // Cascade: clear AmbassadorCommunityId on all affected users
        var update = Builders<User>.Update.Set(u => u.AmbassadorCommunityId, (string?)null);
        await db.Users.UpdateManyAsync(u => u.AmbassadorCommunityId == id, update);

        return true;
    }
}
