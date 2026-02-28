using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class CompanionService(MongoDbContext db) : ICompanionService
{
    public async Task<List<Companion>> GetByUserId(
        string userId, bool isAuthenticated, bool isAdmin, bool isOwner)
    {
        var filter = Builders<Companion>.Filter.Eq(c => c.UserId, userId);

        if (!isAdmin && !isOwner)
        {
            var visFilter = isAuthenticated
                ? Builders<Companion>.Filter.In(c => c.Visibility,
                    new[] { Visibility.Public, Visibility.MembersOnly })
                : Builders<Companion>.Filter.Eq(c => c.Visibility, Visibility.Public);

            filter = Builders<Companion>.Filter.And(filter, visFilter);
        }

        var companions = await db.Companions.Find(filter).ToListAsync();

        // Sort by user-defined order, with createdAt as stable tiebreaker for companions
        // that haven't been explicitly ordered yet (all default to Order = 0)
        return companions.OrderBy(c => c.Order).ThenBy(c => c.CreatedAt).ToList();
    }

    public async Task<Companion?> GetById(string id)
    {
        return await db.Companions.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Companion> Create(string userId, CompanionCreateRequest request)
    {
        // Assign order at end of existing list
        var count = (int)await db.Companions.CountDocumentsAsync(c => c.UserId == userId);

        var companion = new Companion
        {
            UserId = userId,
            Visibility = request.Visibility,
            Name = request.Name,
            Platform = request.Platform,
            Role = request.Role,
            DateOfBirth = request.DateOfBirth,
            Bio = request.Bio,
            Alignment = request.Alignment,
            Order = count,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await db.Companions.InsertOneAsync(companion);
        return companion;
    }

    public async Task<Companion?> Update(string id, CompanionUpdateRequest request)
    {
        var updateDefs = new List<UpdateDefinition<Companion>>();

        if (request.Visibility.HasValue)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Visibility, request.Visibility.Value));
        if (request.Name is not null)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Name, request.Name));
        if (request.Platform is not null)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Platform, request.Platform));
        if (request.Role is not null)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Role, request.Role));
        if (request.DateOfBirth.HasValue)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.DateOfBirth, request.DateOfBirth.Value));
        if (request.Bio is not null)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Bio, request.Bio));
        if (request.ClearAlignment)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Alignment, (Alignment?)null));
        else if (request.Alignment.HasValue)
            updateDefs.Add(Builders<Companion>.Update.Set(c => c.Alignment, request.Alignment.Value));

        if (updateDefs.Count == 0) return await GetById(id);

        updateDefs.Add(Builders<Companion>.Update.Set(c => c.UpdatedAt, DateTime.UtcNow));

        var update = Builders<Companion>.Update.Combine(updateDefs);
        await db.Companions.UpdateOneAsync(c => c.Id == id, update);

        return await GetById(id);
    }

    public async Task<bool> Delete(string id)
    {
        var result = await db.Companions.DeleteOneAsync(c => c.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<Companion?> UpdateProfileImage(string id, string? filename)
    {
        var update = Builders<Companion>.Update
            .Set(c => c.ProfileImageFilename, filename)
            .Set(c => c.UpdatedAt, DateTime.UtcNow);

        await db.Companions.UpdateOneAsync(c => c.Id == id, update);
        return await GetById(id);
    }

    public async Task ReorderAsync(string userId, List<string> companionIds)
    {
        if (companionIds.Count == 0) return;

        var writes = companionIds
            .Select((id, index) => new UpdateOneModel<Companion>(
                Builders<Companion>.Filter.And(
                    Builders<Companion>.Filter.Eq(c => c.Id, id),
                    Builders<Companion>.Filter.Eq(c => c.UserId, userId)
                ),
                Builders<Companion>.Update.Set(c => c.Order, index)
            ))
            .ToList<WriteModel<Companion>>();

        await db.Companions.BulkWriteAsync(writes);
    }
}
