using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class SocialService(MongoDbContext db) : ISocialService
{
    public async Task Follow(string fromUserId, string toUserId)
    {
        var exists = await db.SocialEdges.Find(
            e => e.FromUserId == fromUserId && e.ToUserId == toUserId && e.EdgeType == "follow")
            .AnyAsync();

        if (!exists)
        {
            await db.SocialEdges.InsertOneAsync(new SocialEdge
            {
                FromUserId = fromUserId,
                ToUserId = toUserId,
                EdgeType = "follow",
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    public async Task Unfollow(string fromUserId, string toUserId)
    {
        await db.SocialEdges.DeleteOneAsync(
            e => e.FromUserId == fromUserId && e.ToUserId == toUserId && e.EdgeType == "follow");
    }

    public async Task Ignore(string fromUserId, string toUserId)
    {
        var exists = await db.SocialEdges.Find(
            e => e.FromUserId == fromUserId && e.ToUserId == toUserId && e.EdgeType == "ignore")
            .AnyAsync();

        if (!exists)
        {
            await db.SocialEdges.InsertOneAsync(new SocialEdge
            {
                FromUserId = fromUserId,
                ToUserId = toUserId,
                EdgeType = "ignore",
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    public async Task RemoveIgnore(string fromUserId, string toUserId)
    {
        await db.SocialEdges.DeleteOneAsync(
            e => e.FromUserId == fromUserId && e.ToUserId == toUserId && e.EdgeType == "ignore");
    }

    public async Task Block(string fromUserId, string toUserId)
    {
        var exists = await db.SocialEdges.Find(
            e => e.FromUserId == fromUserId && e.ToUserId == toUserId && e.EdgeType == "block")
            .AnyAsync();

        if (!exists)
        {
            await db.SocialEdges.InsertOneAsync(new SocialEdge
            {
                FromUserId = fromUserId,
                ToUserId = toUserId,
                EdgeType = "block",
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    public async Task Unblock(string fromUserId, string toUserId)
    {
        await db.SocialEdges.DeleteOneAsync(
            e => e.FromUserId == fromUserId && e.ToUserId == toUserId && e.EdgeType == "block");
    }

    public async Task<bool> IsBlockedBy(string contentOwnerUserId, string visitorUserId)
    {
        return await db.SocialEdges.Find(
            e => e.FromUserId == contentOwnerUserId && e.ToUserId == visitorUserId && e.EdgeType == "block")
            .AnyAsync();
    }

    public async Task<SocialStateResponse> GetSocialState(string userId)
    {
        var edges = await db.SocialEdges
            .Find(e => e.FromUserId == userId)
            .ToListAsync();

        return new SocialStateResponse
        {
            FollowingUserIds = edges.Where(e => e.EdgeType == "follow").Select(e => e.ToUserId).ToList(),
            IgnoringUserIds = edges.Where(e => e.EdgeType == "ignore").Select(e => e.ToUserId).ToList(),
            BlockedUserIds = edges.Where(e => e.EdgeType == "block").Select(e => e.ToUserId).ToList()
        };
    }

    public async Task<List<string>> GetFollowingIds(string userId)
    {
        var edges = await db.SocialEdges
            .Find(e => e.FromUserId == userId && e.EdgeType == "follow")
            .ToListAsync();
        return edges.Select(e => e.ToUserId).ToList();
    }

    public async Task<List<string>> GetIgnoringIds(string userId)
    {
        var edges = await db.SocialEdges
            .Find(e => e.FromUserId == userId && e.EdgeType == "ignore")
            .ToListAsync();
        return edges.Select(e => e.ToUserId).ToList();
    }
}
