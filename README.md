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

The frontend proxies API requests to the backend container, so no frontend
configuration change is needed. MongoDB and Redis stay private to Compose,
and the backend is private to Compose, which avoids conflicts with other local
services using ports `27017`, `6379`, `5000`, or `5001`.

The development environment seeds demo data for both websites, including nailists, services, and schedules.
MongoDB and Redis are available to the backend over the private Compose network;
Redis does not bind host port `6379`, so an existing local Redis installation
will not prevent the stack from starting.

The backend is reachable from the frontend container at `http://backend:8080`.
Use the backend container logs for startup and runtime diagnostics:

```bash
docker compose logs -f backend
```

Developer control panel:

- http://localhost:3000/admin
- Seeded developer email: `vladislavssmine@gmail.com`
- The OTP is printed in the backend container logs:

```bash
docker compose logs -f backend
```

Only the seeded database identity with the `Developer` role can access business and website management APIs.

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
