FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/StudioPlatform.sln backend/
COPY backend/src/StudioPlatform.Host/StudioPlatform.Host.csproj backend/src/StudioPlatform.Host/
COPY backend/src/StudioPlatform.Shared/StudioPlatform.Shared.csproj backend/src/StudioPlatform.Shared/
COPY backend/src/Modules/StudioPlatform.Modules.Agenda/StudioPlatform.Modules.Agenda.csproj backend/src/Modules/StudioPlatform.Modules.Agenda/
COPY backend/src/Modules/StudioPlatform.Modules.Auth/StudioPlatform.Modules.Auth.csproj backend/src/Modules/StudioPlatform.Modules.Auth/
COPY backend/src/Modules/StudioPlatform.Modules.Business/StudioPlatform.Modules.Business.csproj backend/src/Modules/StudioPlatform.Modules.Business/
COPY backend/src/Modules/StudioPlatform.Modules.Core/StudioPlatform.Modules.Core.csproj backend/src/Modules/StudioPlatform.Modules.Core/
COPY backend/src/Modules/StudioPlatform.Modules.Customers/StudioPlatform.Modules.Customers.csproj backend/src/Modules/StudioPlatform.Modules.Customers/
COPY backend/src/Modules/StudioPlatform.Modules.Employees/StudioPlatform.Modules.Employees.csproj backend/src/Modules/StudioPlatform.Modules.Employees/
COPY backend/tests/StudioPlatform.Shared.Tests/StudioPlatform.Shared.Tests.csproj backend/tests/StudioPlatform.Shared.Tests/
RUN dotnet restore backend/StudioPlatform.sln

COPY backend/src backend/src
COPY backend/tests backend/tests
RUN dotnet test backend/tests/StudioPlatform.Shared.Tests/StudioPlatform.Shared.Tests.csproj --no-restore

RUN dotnet publish backend/src/StudioPlatform.Host/StudioPlatform.Host.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "StudioPlatform.Host.dll"]
