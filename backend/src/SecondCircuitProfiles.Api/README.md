# SecondCircuitProfiles.Api

ASP.NET Core Web API service for profiles.secondcircuit.io

## Technology Stack

- .NET 10.0
- ASP.NET Core Web API
- API Controllers pattern
- MSTest for testing

## Getting Started

### Prerequisites

- .NET 10.0 SDK or later

### Building the Project

```bash
dotnet build
```

### Running the API

```bash
cd src/SecondCircuitProfiles.Api
dotnet run
```

The API will start and listen on:
- HTTP: http://localhost:5000
- HTTPS: https://localhost:5001

### Running Tests

From the solution root:

```bash
dotnet test
```

## API Endpoints

### Weather Forecast (Example)

- **GET** `/WeatherForecast` - Returns a collection of weather forecasts

## Authentication

No authentication is currently configured. Custom authentication will be implemented in future iterations.

## Project Structure

```
SecondCircuitProfiles/
├── src/
│   └── SecondCircuitProfiles.Api/      # Main Web API project
│       ├── Controllers/                # API Controllers
│       ├── Program.cs                  # Application entry point
│       └── appsettings.json           # Configuration
└── tests/
    └── SecondCircuitProfiles.Api.Tests/ # MSTest test project
```

## Development

### Adding New Controllers

1. Create a new class in the `Controllers` folder
2. Inherit from `ControllerBase`
3. Add the `[ApiController]` and `[Route]` attributes

Example:

```csharp
using Microsoft.AspNetCore.Mvc;

namespace SecondCircuitProfiles.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MyController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { message = "Hello World" });
    }
}
```

### Adding Tests

Tests are located in the `tests/SecondCircuitProfiles.Api.Tests` project. Add new test classes following the MSTest pattern.
