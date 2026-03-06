FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS base
WORKDIR /app
EXPOSE 8080
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app/uploads

FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src
COPY ["src/SecondCircuitProfiles.Api/SecondCircuitProfiles.Api.csproj", "SecondCircuitProfiles.Api/"]
RUN dotnet restore "SecondCircuitProfiles.Api/SecondCircuitProfiles.Api.csproj"
COPY src/SecondCircuitProfiles.Api/ SecondCircuitProfiles.Api/
WORKDIR /src/SecondCircuitProfiles.Api
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "SecondCircuitProfiles.Api.dll"]
