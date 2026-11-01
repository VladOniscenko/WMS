# StudioPlatform

## Run locally with Docker

Prerequisites:

- Docker Desktop with Docker Compose

Start the full stack from the repository root:

```bash
docker compose up --build
```

Open the frontend in a browser:

- http://localhost:3000/?site=glow-center
- http://localhost:3000/?site=glow-south

The development environment seeds demo data for both websites, including nailists, services, and schedules.

Backend endpoints:

- Health: http://localhost:5000/health
- Swagger: http://localhost:5000/swagger

Stop the stack:

```bash
docker compose down
```

To also remove the persisted MongoDB volume:

```bash
docker compose down -v
```

## Build and test without Docker

The backend targets .NET 10:

```bash
cd backend
dotnet restore
dotnet build
dotnet test
```

Build the frontend:

```bash
cd frontend/studio-web
npm install
npm run build
```

Create NuGet packages:

```bash
./scripts/pack-modules.sh
```
