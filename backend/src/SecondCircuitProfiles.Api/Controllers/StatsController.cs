using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using SecondCircuitProfiles.Api.DTOs;
using SecondCircuitProfiles.Api.Models;
using SecondCircuitProfiles.Api.Services;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/stats")]
[Produces("application/json")]
public class StatsController(MongoDbContext db) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<StatsResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats()
    {
        var isAuthenticated = User.Identity?.IsAuthenticated == true;
        var isAdmin = User.FindFirstValue("is_admin") == "true";

        FilterDefinition<User> userFilter;
        FilterDefinition<Companion> companionFilter;

        if (isAdmin)
        {
            userFilter = Builders<User>.Filter.Empty;
            companionFilter = Builders<Companion>.Filter.Empty;
        }
        else if (isAuthenticated)
        {
            var notBlocked = Builders<User>.Filter.Ne(u => u.IsBlocked, true);
            userFilter = Builders<User>.Filter.And(
                notBlocked,
                Builders<User>.Filter.In(u => u.Visibility,
                    new[] { Visibility.Public, Visibility.MembersOnly }));
            companionFilter = Builders<Companion>.Filter.In(c => c.Visibility,
                new[] { Visibility.Public, Visibility.MembersOnly });
        }
        else
        {
            var notBlocked = Builders<User>.Filter.Ne(u => u.IsBlocked, true);
            userFilter = Builders<User>.Filter.And(
                notBlocked,
                Builders<User>.Filter.Eq(u => u.Visibility, Visibility.Public));
            companionFilter = Builders<Companion>.Filter.Eq(c => c.Visibility, Visibility.Public);
        }

        var totalUsers = await db.Users.CountDocumentsAsync(userFilter);
        var totalCompanions = await db.Companions.CountDocumentsAsync(companionFilter);

        return Ok(new StatsResponse
        {
            TotalUsers = totalUsers,
            TotalCompanions = totalCompanions
        });
    }
}
