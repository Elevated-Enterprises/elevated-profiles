using MongoDB.Driver;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class LlmProviderService(MongoDbContext db) : ILlmProviderService
{
    public async Task<List<LlmProvider>> GetAll()
    {
        return await db.LlmProviders.Find(_ => true)
            .SortBy(l => l.Name)
            .ToListAsync();
    }

    public async Task<LlmProvider?> GetById(string id)
    {
        return await db.LlmProviders.Find(l => l.Id == id).FirstOrDefaultAsync();
    }

    public async Task<List<LlmProvider>> GetByIds(IEnumerable<string> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return [];
        return await db.LlmProviders
            .Find(Builders<LlmProvider>.Filter.In(l => l.Id, idList))
            .ToListAsync();
    }

    public async Task<LlmProvider> Create(string name)
    {
        var provider = new LlmProvider
        {
            Name = name.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.LlmProviders.InsertOneAsync(provider);
        return provider;
    }

    public async Task<bool> Delete(string id)
    {
        var result = await db.LlmProviders.DeleteOneAsync(l => l.Id == id);
        return result.DeletedCount > 0;
    }
}
