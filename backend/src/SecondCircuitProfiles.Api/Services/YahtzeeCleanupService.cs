namespace SecondCircuitProfiles.Api.Services;

public class YahtzeeCleanupService(IYahtzeeService yahtzeeService, ILogger<YahtzeeCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("YahtzeeCleanupService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                await yahtzeeService.CleanupAbandonedGamesAsync();
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during Yahtzee game cleanup.");
            }
        }

        logger.LogInformation("YahtzeeCleanupService stopped.");
    }
}
