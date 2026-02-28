namespace SecondCircuitProfiles.Api.Services;

public class PigCleanupService(IPigService pigService, ILogger<PigCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("PigCleanupService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                await pigService.CleanupAbandonedGamesAsync();
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during pig game cleanup.");
            }
        }

        logger.LogInformation("PigCleanupService stopped.");
    }
}
