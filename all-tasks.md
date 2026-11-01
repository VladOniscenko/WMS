# Studio Platform - Agent Execution Backlog

**Architecture Overview:**

- **Pattern:** Modular Monolith (Package-ready). Each backend module lives in its own C# class library and registers itself via `IModule` in `StudioPlatform.Shared`. Modules **never** reference other modules directly; they communicate only through `StudioPlatform.Shared` contracts and an internal Event/Contract bus.
- **Multi-Tenancy:** One Business (`BusinessId`) can own multiple Websites (`WebsiteId`). Requests carry `X-Business-Id` and `X-Website-Id` headers.
- **Database Isolation:** All modules share the MongoDB cluster, but each module uses its own isolated database or collection prefix (e.g., `customers_db`, `employees_db`, `agenda_db`) so any module can be extracted to a standalone microservice or another project seamlessly.

---

## Epic 1: Project Foundation & Infrastructure

### [TICKET-001] Initialize Repository, Solution, and Folder Structure

**Agent Role:** Backend / DevOps Agent
**Description:** Set up the initial monorepo folder structure, the C# `.sln` file, the main Web API host project, and the React TypeScript frontend project. Create independent C# class libraries for each module so they can later be exported as reusable NuGet packages.

**Tasks:**

1. Create root directories: `/backend`, `/frontend`, `/docker`.
2. Inside `/backend`, run `dotnet new sln -n StudioPlatform`.
3. Create the main entry project: `dotnet new webapi -n StudioPlatform.Host -o backend/src/StudioPlatform.Host`.
4. Create a shared building blocks library: `dotnet new classlib -n StudioPlatform.Shared -o backend/src/StudioPlatform.Shared`.
5. Create independent module libraries inside `backend/src/Modules/`:
   - `StudioPlatform.Modules.Core`
   - `StudioPlatform.Modules.Business`
   - `StudioPlatform.Modules.Auth`
   - `StudioPlatform.Modules.Customers`
   - `StudioPlatform.Modules.Employees`
   - `StudioPlatform.Modules.Agenda`
6. Add all C# projects to `StudioPlatform.sln` and reference them in `StudioPlatform.Host`. Each module project may **only** reference `StudioPlatform.Shared`.
7. Inside `/frontend`, initialize the WMS Web Vite React TypeScript project: `npm create vite@latest wms-web -- --template react-ts`.

**Acceptance Criteria:**

- Running `dotnet build` inside `/backend` succeeds with 0 errors.
- Running `npm run build` inside `/frontend/wms-web` succeeds with 0 errors.
- No module project directly references another module project (strictly decoupled).

---

### [TICKET-002] Docker & Docker Compose Setup (Mongo, Redis, API, Web)

**Agent Role:** DevOps Agent
**Description:** Create Dockerfiles for the C# backend and React frontend, and a `docker-compose.yml` file at the root to spin up MongoDB, Redis, the Backend API, and the Frontend.

**Tasks:**

1. Create `/docker/backend.Dockerfile` using the official `.NET 8 SDK` and `ASP.NET runtime` images.
2. Create `/docker/frontend.Dockerfile` using `node:20-alpine` for building and `nginx:alpine` for serving.
3. Create `docker-compose.yml` in the root folder with 4 services:
   - `mongodb`: image `mongo:7`, port `27017:27017`, with a persistent volume.
   - `redis`: image `redis:7-alpine`, port `6379:6379`.
   - `backend`: builds from `/docker/backend.Dockerfile`, port `5000:8080`, depends on `mongodb` and `redis`. Pass connection strings via environment variables.
   - `frontend`: builds from `/docker/frontend.Dockerfile`, port `3000:80`.

**Acceptance Criteria:**

- Running `docker compose up --build` starts all 4 containers without crashing.
- Backend can reach MongoDB at `mongodb://mongodb:27017` and Redis at `redis:6379`.

---

### [TICKET-003] Shared Kernel: Module Loader, Multi-Tenancy, Mongo & Redis Abstractions

**Agent Role:** Backend Architect Agent
**Description:** Build `StudioPlatform.Shared` so that every module can self-register its services and endpoints, access MongoDB and Redis cleanly, and automatically resolve the current tenant (`BusinessId` and `WebsiteId`) from incoming HTTP headers.

**Tasks:**

1. Install NuGet packages in `StudioPlatform.Shared`: `MongoDB.Driver`, `StackExchange.Redis`, `Microsoft.AspNetCore.Http.Abstractions`, `Microsoft.Extensions.Configuration.Abstractions`, `Microsoft.Extensions.DependencyInjection.Abstractions`.
2. Create `IModule` interface in `StudioPlatform.Shared/Modules/IModule.cs`:
   - `void RegisterModule(IServiceCollection services, IConfiguration configuration);`
   - `void MapEndpoints(IEndpointRouteBuilder endpoints);`
3. Create `TenantContext` and `ITenantProvider` in `StudioPlatform.Shared/Tenancy/`:
   - Reads `X-Business-Id` and `X-Website-Id` from HTTP request headers (or JWT claims if authenticated).
   - Register `TenantResolutionMiddleware` in `StudioPlatform.Shared`.
4. Create a generic MongoDB repository in `StudioPlatform.Shared/Persistence/`:
   - `BaseEntity` with `Guid Id`, `Guid BusinessId`, `DateTime CreatedAtUtc`, `DateTime UpdatedAtUtc`.
   - `IMongoRepository<T>` and `MongoRepository<T>` where each module specifies its own database name (e.g., ` studio_customers`, `studio_agenda`) to guarantee database-level separation.
5. Create `IRedisCacheService` in `StudioPlatform.Shared/Caching/` wrapping `IConnectionMultiplexer` with methods: `SetAsync<T>(string key, T value, TimeSpan ttl)`, `GetAsync<T>(string key)`, `RemoveAsync(string key)`, and `AcquireLockAsync(string key, TimeSpan ttl)`.
6. Wire up `AddSharedInfrastructure()` and automatic `IModule` discovery/registration in `StudioPlatform.Host/Program.cs`.

**Acceptance Criteria:**

- `StudioPlatform.Host` starts up, connects to MongoDB and Redis, and exposes a `/health` endpoint verifying both connections.
- Any module implementing `IModule` is automatically registered and its Minimal API endpoints appear in Swagger (`/swagger`).
- Calling `ITenantProvider.BusinessId` inside any request returns the parsed `X-Business-Id` header.

---

### [TICKET-004] Inter-Module Event Bus & Shared Contracts

**Agent Role:** Backend Architect Agent
**Description:** Since modules cannot reference each other directly, create an in-process/Redis-backed Event Bus and shared DTO contracts in `StudioPlatform.Shared` so modules can react to events (e.g., when a user authenticates, or when an employee updates their availability).

**Tasks:**

1. In `StudioPlatform.Shared/Messaging/`, define:
   - `IIntegrationEvent` (marker interface with `Guid EventId`, `DateTime OccurredOnUtc`, `Guid BusinessId`).
   - `IIntegrationEventHandler<TEvent> where TEvent : IIntegrationEvent`.
   - `IEventBus` with `PublishAsync<TEvent>(TEvent @event, CancellationToken ct)`.
2. Implement `InMemoryEventBus` (using `IServiceProvider` to resolve all registered `IIntegrationEventHandler<TEvent>` instances) in `StudioPlatform.Shared`.
3. Define core shared contracts in `StudioPlatform.Shared/Contracts/`:
   - `UserAuthenticatedIntegrationEvent(Guid UserId, Guid BusinessId, string Email, string Role)`
   - `EmployeeScheduleUpdatedIntegrationEvent(Guid BusinessId, Guid? WebsiteId, Guid EmployeeId, List<WorkingWindowDto> Windows)`
   - `IResourceAvailabilityLookup` (optional query contract if synchronous lookup is needed across modules).
4. Write a unit or integration test verifying that publishing an event triggers handlers in decoupled modules.

**Acceptance Criteria:**

- Publishing an `IIntegrationEvent` via `IEventBus` executes all subscribed handlers across loaded modules without direct project references.

---

## Epic 2: Business, Multi-Website & CMS Module

### [TICKET-005] Business & Multi-Website Management (`StudioPlatform.Modules.Business`)

**Agent Role:** Backend Agent
**Description:** Implement the Business module that allows an owner/client to register a Business and create multiple Websites under that Business, along with toggling which modules (Agenda, Nailists CMS, Customer Portal) are active for each website.

**Tasks:**

1. Create entities in `StudioPlatform.Modules.Business/Domain/`:
   - `BusinessEntity`: `Id`, `Name`, `OwnerEmail`, `SubscriptionTier`, `IsActive`.
   - `WebsiteEntity`: `Id`, `BusinessId`, `Name`, `DomainOrSlug` (e.g., `glow-nails-amsterdam`), `EnabledModules` (`List<string>` e.g., `["agenda", "employees", "customers", "cms"]`), `ThemeConfig` (primary color, logo URL, font).
2. Register MongoDB repositories using database name `studio_business`.
3. Implement Minimal API endpoints under `/api/businesses` and `/api/websites`:
   - `POST /api/businesses` - Create a new business.
   - `GET /api/businesses/{id}` - Get business details and all its websites.
   - `POST /api/businesses/{businessId}/websites` - Create a website for a business and configure enabled modules.
   - `GET /api/websites/resolve?slug={domainOrSlug}` - Public endpoint used by the React frontend on boot to resolve `BusinessId`, `WebsiteId`, `ThemeConfig`, and `EnabledModules`.
4. Implement `BusinessModule : IModule`.

**Acceptance Criteria:**

- One business can create multiple websites via the API.
- Calling `GET /api/websites/resolve?slug=glow-nails` returns the exact `BusinessId`, `WebsiteId`, and enabled module list.

---

### [TICKET-006] Headless CMS & Service Catalog Module (`StudioPlatform.Modules.Core`)

**Agent Role:** Backend Agent
**Description:** Build a lightweight headless CMS inside `StudioPlatform.Modules.Core` so each website can manage custom pages/sections (hero text, gallery, about) and a catalog of bookable services (e.g., "BIAB Manicure - 60 min - €55", "Gel Pedicure - 45 min - €45").

**Tasks:**

1. Create entities in `StudioPlatform.Modules.Core/Domain/` (isolated by `BusinessId` and `WebsiteId`):
   - `CmsPageSection`: `Id`, `BusinessId`, `WebsiteId`, `PageKey` (e.g., `home`), `SectionKey` (e.g., `hero`, `gallery`), `ContentJson` (flexible key-value/JSON structure), `Order`.
   - `CatalogServiceItem`: `Id`, `BusinessId`, `WebsiteId`, `Name`, `Description`, `DurationMinutes`, `Price`, `Currency`, `Category`, `IsActive`.
2. Register MongoDB repositories using database name `studio_cms`.
3. Create endpoints:
   - `GET /api/cms/pages/{pageKey}` & `PUT /api/cms/pages/{pageKey}` (reads `X-Website-Id` header).
   - `GET /api/catalog/services`, `POST /api/catalog/services`, `PUT /api/catalog/services/{id}`, `DELETE /api/catalog/services/{id}`.

**Acceptance Criteria:**

- Services (with `DurationMinutes` and `Price`) and CMS sections can be created and fetched per `WebsiteId`.
- Data from Website A never leaks when querying with Website B's header.

---

## Epic 3: Passwordless Email Authentication Module

### [TICKET-007] Redis OTP Engine & Pluggable Email Sender (`StudioPlatform.Modules.Auth`)

**Agent Role:** Backend Agent
**Description:** Build the core passwordless authentication engine in `StudioPlatform.Modules.Auth`. Users (both Customers and Employees/Admins) log in exclusively via email: the system generates a 6-digit one-time passcode (OTP), stores it in Redis with a 10-minute TTL and rate-limiting, and sends it via email.

**Tasks:**

1. In `StudioPlatform.Modules.Auth`, create `IEmailSender` interface and two implementations:
   - `ConsoleDevelopmentEmailSender` (logs the 6-digit OTP clearly to console/docker logs and stores the last code in a dev-only Redis key for easy automated testing).
   - `SmtpEmailSender` (configured via environment variables for production).
2. Create `IOtpService` and `RedisOtpService`:
   - Generates a cryptographically random 6-digit numeric code (`100000`–`999999`).
   - Stores hash/code in Redis under key `auth:otp:{businessId}:{email.ToLowerInvariant()}` with TTL = 10 minutes.
   - Tracks attempt count under `auth:otp:attempts:{businessId}:{email}` (max 5 failed attempts before invalidating the code, max 3 requests per 5 minutes to prevent spam).
3. Create `AuthIdentity` MongoDB document in database `studio_auth`:
   - `Id`, `BusinessId`, `Email`, `Roles` (`["Customer"]`, `["Employee"]`, `["BusinessAdmin"]`), `LastLoginAtUtc`.

**Acceptance Criteria:**

- Requesting an OTP stores the code in Redis with a 600-second expiry and outputs the 6-digit code in the container logs.
- Exceeding 5 wrong verification attempts invalidates the OTP immediately.

---

### [TICKET-008] Passwordless Auth Endpoints & JWT Issuance (`StudioPlatform.Modules.Auth`)

**Agent Role:** Backend Agent
**Description:** Expose the passwordless login endpoints that issue signed JWT tokens upon OTP verification and publish `UserAuthenticatedIntegrationEvent` so Customer or Employee modules can link or provision profiles automatically.

**Tasks:**

1. Install `Microsoft.AspNetCore.Authentication.JwtBearer` in `StudioPlatform.Shared` and `StudioPlatform.Modules.Auth`.
2. Configure JWT Bearer authentication in `StudioPlatform.Host` using a secret key from configuration (`Jwt:Secret`, `Jwt:Issuer`, `Jwt:Audience`).
3. Create endpoints in `StudioPlatform.Modules.Auth`:
   - `POST /api/auth/request-code`:
     - Body: `{ "email": "client@example.com", "scope": "customer" | "employee" }`.
     - Validates email format, resolves `BusinessId` from header, generates OTP in Redis, sends email.
   - `POST /api/auth/verify-code`:
     - Body: `{ "email": "client@example.com", "code": "123456" }`.
     - Validates code against Redis. If valid, finds or creates `AuthIdentity` for `(BusinessId, Email)`.
     - Publishes `UserAuthenticatedIntegrationEvent(identity.Id, BusinessId, Email, Role)` via `IEventBus`.
     - Generates and returns a JWT token containing claims: `sub` (`IdentityId`), `email`, `business_id`, and `roles`.
   - `GET /api/auth/me` (Requires Authorization): returns current token claims.

**Acceptance Criteria:**

- Calling `POST /api/auth/request-code` followed by `POST /api/auth/verify-code` with the generated code returns a valid `200 OK` with `{ accessToken, expiresAt, user }`.
- Subsequent calls with the same OTP fail (single-use enforcement).

---

## Epic 4: Customers Gateway Module

### [TICKET-009] Customer Gateway Domain & Endpoints (`StudioPlatform.Modules.Customers`)

**Agent Role:** Backend Agent
**Description:** Build the standalone Customers Gateway module. A customer belongs to a `BusinessId` (so if a business has 3 nail studio websites, the customer shares one centralized profile across all 3 websites of that business).

**Tasks:**

1. Create `CustomerProfile` entity in `StudioPlatform.Modules.Customers/Domain/`:
   - `Id`, `BusinessId`, `AuthIdentityId` (nullable if created manually by staff before first login), `Email`, `FirstName`, `LastName`, `Phone`, `Notes` (e.g., nail allergies/preferences), `ConsentMarketing`, `VisitedWebsiteIds` (`List<Guid>`).
2. Register MongoDB repository using database name `studio_customers` with a unique compound index on `(BusinessId, Email)`.
3. Implement `UserAuthenticatedHandler : IIntegrationEventHandler<UserAuthenticatedIntegrationEvent>`:
   - When a user logs in via passwordless auth, check if a `CustomerProfile` exists for `(BusinessId, Email)`. If not, auto-create a stub profile and link `AuthIdentityId`.
4. Implement Minimal API endpoints under `/api/customers`:
   - `GET /api/customers/me` (Authenticated Customer): Get own profile.
   - `PUT /api/customers/me` (Authenticated Customer): Update own name, phone, preferences.
   - `GET /api/customers` (Employee/Admin): Paginated & searchable list of customers for the current `BusinessId`.
   - `POST /api/customers` (Employee/Admin): Create a walk-in or manual customer profile.
   - `GET /api/customers/{id}` (Employee/Admin): Get specific customer details.

**Acceptance Criteria:**

- Logging in via OTP automatically creates a `CustomerProfile` in the `studio_customers` database.
- Updating the customer profile on Website 1 of a Business immediately reflects when queried from Website 2 of the same Business.
- `StudioPlatform.Modules.Customers` compiles and runs with zero references to `Auth`, `Employees`, or `Agenda`.

---

## Epic 5: Employees Gateway Module

### [TICKET-010] Employees (Nailists) Gateway & Schedule Rules (`StudioPlatform.Modules.Employees`)

**Agent Role:** Backend Agent
**Description:** Build the centralized Employees Gateway module. Employees (e.g., nail technicians) belong to a `BusinessId` and can be assigned to one or more `WebsiteIds`, have a public bio/avatar for the Nailists CMS showcase, a list of skills/service IDs they perform, and weekly working hours.

**Tasks:**

1. Create entities in `StudioPlatform.Modules.Employees/Domain/`:
   - `EmployeeProfile`: `Id`, `BusinessId`, `AssignedWebsiteIds` (`List<Guid>`), `Email`, `DisplayName`, `RoleTitle` (e.g., "Senior Nail Artist"), `Bio`, `AvatarUrl`, `ColorHex`, `SkillTags` (`List<string>`), `IsActive`.
   - `EmployeeWeeklySchedule`: `EmployeeId`, `BusinessId`, `WebsiteId` (optional override per location), `Windows` (List of `DayOfWeek`, `StartTime` e.g. `"09:00"`, `EndTime` e.g. `"17:30"`, `BreakStart`, `BreakEnd`).
2. Register MongoDB repositories using database name `studio_employees`.
3. Create endpoints under `/api/employees`:
   - `GET /api/employees/public` - Public endpoint returning active employees (nailists) assigned to the current `X-Website-Id` (used for the Nailists CMS showcase & booking picker).
   - `GET /api/employees` & `POST /api/employees` & `PUT /api/employees/{id}` - Admin CRUD for managing staff across the business.
   - `PUT /api/employees/{id}/schedule` - Updates the employee's working hours and publishes `EmployeeScheduleUpdatedIntegrationEvent` to `IEventBus`.

**Acceptance Criteria:**

- An employee created under a Business can be assigned to specific websites and fetched via `GET /api/employees/public`.
- Updating an employee's schedule saves to `studio_employees` and publishes `EmployeeScheduleUpdatedIntegrationEvent`.
- `StudioPlatform.Modules.Employees` has zero project references to `Customers` or `Agenda`.

---

## Epic 6: Decoupled Agenda Gateway Module

### [TICKET-011] Agenda Domain: Generic Resources, Availability & Reservations (`StudioPlatform.Modules.Agenda`)

**Agent Role:** Backend Agent
**Description:** Build the Agenda module as a 100% standalone booking engine. To keep Agenda completely decoupled from Employees and Customers (so it can be moved to any project), Agenda operates on generic concepts:

- **`ResourceId`** (represents the Employee/Nailist ID, passed as a `Guid`).
- **`ClientId`** (represents the Customer ID, passed as a `Guid`).
- **`ServiceDurationMinutes`** (passed at booking/query time).

**Tasks:**

1. Create entities in `StudioPlatform.Modules.Agenda/Domain/`:
   - `ResourceAvailabilitySchedule`: `Id`, `BusinessId`, `WebsiteId`, `ResourceId` (EmployeeId), `WeeklyWindows` (synced via event or set directly via API), `DateOverrides` (vacations, sick leave, custom hours on a specific `DateOnly`).
   - `Reservation`:
     - `Id`, `BusinessId`, `WebsiteId`
     - `ResourceId` (the Nailist/Employee Guid)
     - `ClientId` (the Customer Guid)
     - `ClientSnapshot` (`Name`, `Email`, `Phone` — optional snapshot metadata passed in the command so Agenda never needs to query the Customers DB)
     - `ServiceSnapshot` (`ServiceId`, `ServiceName`, `DurationMinutes`, `Price`)
     - `StartAtUtc` (`DateTime`), `EndAtUtc` (`DateTime`)
     - `Status` (`Pending`, `Confirmed`, `Cancelled`, `Completed`)
     - `Notes`
2. Register MongoDB repositories in database `studio_agenda` with indexes on `(BusinessId, ResourceId, StartAtUtc, EndAtUtc)`.
3. Implement `EmployeeScheduleSyncHandler : IIntegrationEventHandler<EmployeeScheduleUpdatedIntegrationEvent>` inside `StudioPlatform.Modules.Agenda` so whenever an employee's working hours change in the Employee module, Agenda updates its own `ResourceAvailabilitySchedule` automatically.

**Acceptance Criteria:**

- `StudioPlatform.Modules.Agenda` has zero project or database dependencies on `Employees` or `Customers`.
- Updating an employee schedule in `Employees` automatically syncs to `ResourceAvailabilitySchedule` in `Agenda` via `IEventBus`.

---

### [TICKET-012] Slot Calculation Engine & Redis Distributed Locking (`StudioPlatform.Modules.Agenda`)

**Agent Role:** Backend Agent
**Description:** Implement the availability calculation service and reservation creation logic in `StudioPlatform.Modules.Agenda`. Use Redis distributed locks to guarantee two customers cannot double-book the same nailist at the exact same millisecond.

**Tasks:**

1. Create `IAvailabilityCalculator` in `StudioPlatform.Modules.Agenda/Services/`:
   - Input: `BusinessId`, `WebsiteId`, `ResourceId` (or `null` for "Any available nailist"), `DateOnly Date`, `int DurationMinutes`, `int SlotIntervalMinutes = 15`.
   - Logic:
     1. Load `ResourceAvailabilitySchedule` for the `ResourceId` on `Date` (taking `DateOverrides` and breaks into account).
     2. Load all active `Reservation` records (`Confirmed` or `Pending`) for `ResourceId` on `Date`.
     3. Slice working windows into candidate slots (e.g., `09:00`, `09:15`, `09:30`...) where `slotStart + DurationMinutes <= windowEnd` and the range `[slotStart, slotEnd)` does not overlap with any break or existing `Reservation`.
     4. Return list of available slots (`StartTimeUtc`, `EndTimeUtc`, `ResourceId`).
2. Create `ReservationService.CreateReservationAsync`:
   - Acquires a Redis lock via `IRedisCacheService.AcquireLockAsync($"agenda:lock:{resourceId}:{date:yyyyMMdd}", TimeSpan.FromSeconds(5))`.
   - Re-verifies inside the lock that `[StartAtUtc, EndAtUtc)` has zero overlapping active reservations for `ResourceId`.
   - Inserts the `Reservation` document into `studio_agenda` and releases the lock.
3. Expose endpoints under `/api/agenda`:
   - `GET /api/agenda/slots?resourceId={guid}&date=2026-11-15&durationMinutes=60` - Public endpoint returning open time slots.
   - `POST /api/agenda/reservations` (Requires Auth) - Books a slot for a `ResourceId` and `ClientId`.
   - `GET /api/agenda/reservations/my` (Customer Auth) - Lists reservations for the logged-in customer.
   - `GET /api/agenda/reservations?from={date}&to={date}&resourceId={guid}` (Employee/Admin Auth) - Calendar view for the studio.
   - `PATCH /api/agenda/reservations/{id}/cancel` - Cancels a reservation and frees the slot.
   - `PUT /api/agenda/resources/{resourceId}/schedule` - Direct endpoint to set a resource's schedule in case Agenda is used in a project without the Employees module.

**Acceptance Criteria:**

- Querying `/api/agenda/slots` returns accurate 15-minute interval slots matching the resource's working hours minus existing bookings.
- Booking a 60-minute slot at `10:00` removes `09:15`–`10:45` (for a 60-min service) from subsequent `/api/agenda/slots` queries.
- Concurrent requests for the exact same `ResourceId` and overlapping time result in one `201 Created` and one `409 Conflict`.

---

## Epic 7: Modular Frontend Architecture (React + TypeScript)

### [TICKET-013] Frontend Modular Package Architecture & Multi-Tenant Context

**Agent Role:** Frontend Architect Agent
**Description:** Structure `/frontend/wms-web` so each feature module (`auth`, `customers`, `employees`, `agenda`, `cms`) lives in an isolated, portable package/directory (`src/modules/<module-name>`) with zero cross-module imports, communicating via a shared frontend SDK (`src/shared`).

**Tasks:**

1. Install dependencies in `/frontend/wms-web`: `react-router-dom`, `@tanstack/react-query`, `axios`, `lucide-react`, ` tailwindcss`.
2. Create the decoupled folder structure inside `src/`:
   - `src/shared/api/httpClient.ts` - Axios instance that automatically attaches `X-Business-Id`, `X-Website-Id`, and `Authorization: Bearer <token>` headers.
   - `src/shared/tenancy/TenantProvider.tsx` - On app load, reads the current hostname or `?site=slug` query param, calls `GET /api/websites/resolve`, applies CSS variables for `ThemeConfig`, and exposes `{ businessId, websiteId, enabledModules }`.
   - `src/modules/auth/`
   - `src/modules/customers/`
   - `src/modules/employees/`
   - `src/modules/agenda/`
   - `src/modules/cms/`
3. Add an ESLint boundary rule (or strict tsconfig path aliases `@shared/*`, `@modules/*`) preventing one module folder from importing directly from another module folder.

**Acceptance Criteria:**

- Loading `http://localhost:3000/?site=glow-nails` resolves the website tenant from the backend and injects `X-Business-Id` and `X-Website-Id` into all API calls.
- `npm run build` succeeds with strict TypeScript checking.

---

### [TICKET-014] Passwordless Email Auth UI Module (`src/modules/auth`)

**Agent Role:** Frontend Agent
**Description:** Build a reusable, drop-in Passwordless Login Modal/Component in `src/modules/auth` that asks only for the user's email address, sends the 6-digit login code, and verifies it to log the user in without passwords.

**Tasks:**

1. Create `AuthProvider` and `useAuth()` hook in `src/shared/auth/` storing the JWT and user state (`id`, `email`, `roles`).
2. In `src/modules/auth/`, build `<PasswordlessLoginModal />` and `<PasswordlessLoginForm />`:
   - **Step 1 (Email Input):** User enters email and clicks "Send Login Code" (`POST /api/auth/request-code`).
   - **Step 2 (6-Digit OTP Input):** Renders 6 auto-advancing digit boxes (with paste support), a countdown timer, and "Verify & Continue" (`POST /api/auth/verify-code`).
   - On success, saves JWT to `AuthProvider` and triggers an `onAuthenticated(user)` callback.
3. Export the component cleanly from `src/modules/auth/index.ts` so any website or booking flow can mount it on demand.

**Acceptance Criteria:**

- Entering an email transitions to the 6-digit code screen.
- Entering the valid 6-digit code logs the user in, stores the JWT, and updates `useAuth().isAuthenticated` to `true`.

---

### [TICKET-015] Nail Studio Public Website: CMS, Nailists Showcase & Decoupled Booking Widget

**Agent Role:** Frontend Agent
**Description:** Build the customer-facing Nail Studio website experience by composing the independent modules (`cms`, `employees`, `agenda`, `auth`, `customers`) together dynamically based on `enabledModules`.

**Tasks:**

1. In `src/modules/cms/`, create `<HeroSection />` and `<ServiceCatalogList />` fetching from `/api/cms/pages/home` and `/api/catalog/services`.
2. In `src/modules/employees/`, create `<NailistsShowcase />` and `<NailistPicker />` fetching from `/api/employees/public` (displays avatar, name, role title, bio, and skills).
3. In `src/modules/agenda/`, create `<AgendaBookingWidget />` taking props `{ selectedService, selectedResourceId, currentUser, onRequireAuth }`:
   - Displays a date picker and fetches open time slots from `GET /api/agenda/slots`.
   - When the user selects a time slot and clicks "Reserve Spot":
     - If not logged in, triggers `onRequireAuth()` which opens `<PasswordlessLoginModal />` inline without losing the selected slot!
     - Once authenticated, submits `POST /api/agenda/reservations` with `resourceId`, `clientId`, `serviceSnapshot`, and `startAtUtc`.
     - Shows a booking confirmation screen and a "My Reservations" list (`GET /api/agenda/reservations/my`).
4. In `src/modules/customers/`, create `<CustomerProfileDrawer />` where the logged-in customer can update their name, phone number, and nail notes (`PUT /api/customers/me`).

**Acceptance Criteria:**

- A visitor can pick a nail service (e.g., BIAB Manicure), choose a Nailist (Employee), pick an available date and time slot, verify their email via the 6-digit code modal, and complete the reservation in a single smooth flow.

---

### [TICKET-016] Multi-Website Admin & Studio Backoffice Portal

**Agent Role:** Frontend Agent
**Description:** Build the backoffice dashboard (`/admin`) where a Business owner or Employee can manage multiple websites, edit CMS content & services, manage employees & working hours, view the centralized customer list, and manage the studio's master Agenda calendar.

**Tasks:**

1. Create `/admin` layout with a top **Website Switcher** dropdown (allowing the business owner to switch between their websites or view business-wide data).
2. Add tabs rendered from each module:
   - **Agenda Calendar (`src/modules/agenda/admin`):** Day/Week timetable grouped by Nailist (`ResourceId`), showing all reservations with ability to cancel or add walk-in bookings.
   - **Employees / Nailists (`src/modules/employees/admin`):** Add/edit nailists, assign them to specific websites, and configure their weekly working hours (`PUT /api/employees/{id}/schedule`).
   - **Customers (`src/modules/customers/admin`):** Centralized searchable table of all customers across the business and their preferences/notes.
   - **Website CMS & Services (`src/modules/cms/admin`):** Manage nail services (price, duration) and website hero/theme settings.

**Acceptance Criteria:**

- Admin can create a Business, add 2 Websites, create 2 Nailists with working hours, add Nail Services, and immediately see those Nailists and available time slots reflected on the public booking page.

---

## Epic 8: Package Portability & End-to-End Verification

### [TICKET-017] NuGet & Frontend Package Export Pipeline + Seed Data

**Agent Role:** DevOps / Backend Agent
**Description:** Configure all backend modules so they can be packed into standalone `.nupkg` packages with a single command, and add a development seeder that pre-populates a demo Nail Studio ("Glow Nail Studio") so the platform works out of the box on `docker compose up`.

**Tasks:**

1. Update `.csproj` files for `StudioPlatform.Shared`, `StudioPlatform.Modules.Auth`, `StudioPlatform.Modules.Customers`, `StudioPlatform.Modules.Employees`, and `StudioPlatform.Modules.Agenda` with NuGet metadata (`PackageId`, `Version`, `Author`, `Description`, `IsPackable=true`).
2. Add a script `/scripts/pack-modules.sh` that runs `dotnet pack -c Release -o ./artifacts/nuget` to prove every module packs cleanly as an independent library.
3. Create a `DemoDataSeeder` in `StudioPlatform.Host` (runs in `Development` mode if database is empty) that seeds:
   - 1 Business: `"Glow Beauty Group"`
   - 2 Websites: `"Glow Nail Studio - Center"` (`slug: glow-center`) and `"Glow Nail Studio - South"` (`slug: glow-south`)
   - 3 Nailists (Employees) with Monday–Saturday `09:00–18:00` schedules (and syncs them to Agenda)
   - 5 Nail Services (BIAB, Gel Polish, Acrylic Full Set, Spa Pedicure, Nail Art)

**Acceptance Criteria:**

- Running `dotnet pack` produces independent `.nupkg` files for `Auth`, `Customers`, `Employees`, and `Agenda` in `/artifacts/nuget`.
- Running `docker compose up --build` on a fresh machine seeds the demo nail studio and makes `http://localhost:3000` immediately bookable.
