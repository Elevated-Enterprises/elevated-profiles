using MongoDB.Driver;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class CommunityRoleService(MongoDbContext db) : ICommunityRoleService
{
    public async Task<List<CommunityRole>> GetAll()
    {
        return await db.CommunityRoles.Find(_ => true)
            .SortBy(r => r.Name)
            .ToListAsync();
    }

    public async Task<List<CommunityRole>> GetByIds(IEnumerable<string> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return [];
        return await db.CommunityRoles
            .Find(Builders<CommunityRole>.Filter.In(r => r.Id, idList))
            .ToListAsync();
    }

    public async Task<CommunityRole> Create(string name)
    {
        var role = new CommunityRole
        {
            Name = name.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.CommunityRoles.InsertOneAsync(role);
        return role;
    }

    public async Task<bool> Delete(string id)
    {
        var result = await db.CommunityRoles.DeleteOneAsync(r => r.Id == id);
        return result.DeletedCount > 0;
    }
}
