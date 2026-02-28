using MongoDB.Driver;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class SkillService(MongoDbContext db) : ISkillService
{
    public async Task<List<Skill>> GetAll()
    {
        return await db.Skills.Find(_ => true)
            .SortBy(s => s.Name)
            .ToListAsync();
    }

    public async Task<Skill?> GetById(string id)
    {
        return await db.Skills.Find(s => s.Id == id).FirstOrDefaultAsync();
    }

    public async Task<List<Skill>> GetByIds(IEnumerable<string> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return [];
        return await db.Skills
            .Find(Builders<Skill>.Filter.In(s => s.Id, idList))
            .ToListAsync();
    }

    public async Task<Skill> Create(string name)
    {
        var skill = new Skill
        {
            Name = name.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.Skills.InsertOneAsync(skill);
        return skill;
    }

    public async Task<bool> Delete(string id)
    {
        var result = await db.Skills.DeleteOneAsync(s => s.Id == id);
        return result.DeletedCount > 0;
    }
}
