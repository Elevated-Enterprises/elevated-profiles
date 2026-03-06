using SecondCircuitProfiles.Api.Models;

namespace SecondCircuitProfiles.Api.Services;

public interface INotificationService
{
    Task CreateAsync(string userId, string type, string title, string body, string? relatedEntityId = null);
    Task<List<Notification>> GetForUserAsync(string userId);
    Task<int> GetUnreadCountAsync(string userId);
    Task<bool> MarkReadAsync(string notificationId, string userId);
    Task MarkAllReadAsync(string userId);
}
