using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class TagService(MongoDbContext db) : ITagService
{
    public async Task<List<TagResponse>> GetAll()
    {
        var tags = await db.Tags.Find(_ => true).SortBy(t => t.SortOrder).ToListAsync();

        var tagNames = tags.Select(t => t.Name).ToList();
        var thoughtCounts = new Dictionary<string, int>();
        foreach (var name in tagNames)
        {
            var count = (int)await db.Thoughts.CountDocumentsAsync(
                Builders<Thought>.Filter.And(
                    Builders<Thought>.Filter.AnyEq(t => t.Tags, name),
                    Builders<Thought>.Filter.Eq(t => t.IsDeleted, false)));
            thoughtCounts[name] = count;
        }

        return tags.Select(t => new TagResponse
        {
            Id = t.Id,
            Name = t.Name,
            Color = t.Color,
            SortOrder = t.SortOrder,
            ThoughtCount = thoughtCounts.GetValueOrDefault(t.Name, 0)
        }).ToList();
    }

    public async Task<TagResponse> Create(TagCreateRequest request)
    {
        var tag = new ThoughtTag
        {
            Name = request.Name.Trim(),
            Color = request.Color?.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        await db.Tags.InsertOneAsync(tag);
        return new TagResponse { Id = tag.Id, Name = tag.Name, Color = tag.Color, SortOrder = tag.SortOrder };
    }

    public async Task<bool> Delete(string id)
    {
        var tag = await db.Tags.Find(t => t.Id == id).FirstOrDefaultAsync();
        if (tag == null) return false;

        var result = await db.Tags.DeleteOneAsync(t => t.Id == id);
        if (result.DeletedCount == 0) return false;

        // Remove tag from all thoughts
        var update = Builders<Thought>.Update.Pull(t => t.Tags, tag.Name);
        await db.Thoughts.UpdateManyAsync(
            Builders<Thought>.Filter.AnyEq(t => t.Tags, tag.Name),
            update);

        return true;
    }
}
