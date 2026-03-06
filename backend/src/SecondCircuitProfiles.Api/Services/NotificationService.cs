using MongoDB.Driver;
using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public class NotificationService(MongoDbContext db) : INotificationService
{
    public async Task CreateAsync(string userId, string type, string title, string body, string? relatedEntityId = null)
    {
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Body = body,
            RelatedEntityId = relatedEntityId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };
        await db.Notifications.InsertOneAsync(notification);
    }

    public async Task<List<Notification>> GetForUserAsync(string userId)
    {
        return await db.Notifications
            .Find(n => n.UserId == userId)
            .SortByDescending(n => n.CreatedAt)
            .Limit(50)
            .ToListAsync();
    }

    public async Task<int> GetUnreadCountAsync(string userId)
    {
        return (int)await db.Notifications
            .CountDocumentsAsync(n => n.UserId == userId && !n.IsRead);
    }

    public async Task<bool> MarkReadAsync(string notificationId, string userId)
    {
        var result = await db.Notifications.UpdateOneAsync(
            n => n.Id == notificationId && n.UserId == userId,
            Builders<Notification>.Update.Set(n => n.IsRead, true));
        return result.ModifiedCount > 0;
    }

    public async Task MarkAllReadAsync(string userId)
    {
        await db.Notifications.UpdateManyAsync(
            n => n.UserId == userId && !n.IsRead,
            Builders<Notification>.Update.Set(n => n.IsRead, true));
    }
}
