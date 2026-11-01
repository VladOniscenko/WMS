# WMS — Full Audit & Jira-Style Improvement Tickets

> **Stack:** React 19 + TypeScript + Vite + Tailwind (frontend) · .NET 10 + MongoDB + Redis (backend) · Docker Compose
> **Status:** MVP skeleton — many flows are broken or missing entirely.

---

## EPIC 1 — Architecture & Project Foundation

---

### WMS-001 · Replace manual `window.history.pushState` routing with React Router

**Type:** Bug / Technical Debt  
**Priority:** Critical  
**Affects:** Entire frontend

**Problem**  
The app uses a hand-rolled `navigate()` helper that calls `window.history.pushState` and fires a fake `popstate` event. This means:

- Browser back/forward buttons behave unpredictably
- Hard-refreshing any `/manage/...` or `/sites/...` URL shows a blank page
- No route params — IDs are parsed with raw `location.pathname.split('/')`
- Route guards (`user ? <WmsManager /> : <Login />`) are scattered in `App.tsx` JSX, not in a proper router

**Acceptance criteria**

1. Install `react-router-dom` (already in `package.json` but **never imported in the app**).
2. Declare a `<BrowserRouter>` with proper `<Route>` definitions in `main.tsx`.
3. Replace all `navigate(path)` calls with `useNavigate()` hook.
4. Replace all `location.pathname.split('/')` ID extractions with `useParams()`.
5. Add a `<Navigate>` redirect from `/` to `/manage`.
6. Add a 404 catch-all route.
7. Protect `/manage/*` and `/admin` with an `<AuthGuard>` component.

---

### WMS-002 · Replace ad-hoc CSS with Tailwind (already installed, never used)

**Type:** Technical Debt  
**Priority:** High  
**Affects:** Entire frontend

**Problem**  
`tailwindcss` is listed in `package.json` but the entire app uses a 19 KB monolithic `index.css` with hand-written selectors. The CSS has no dark-mode support, no design tokens beyond a handful of CSS variables, and styles bleed across public/management contexts. `lucide-react` is also installed but never used.

**Acceptance criteria**

1. Set up Tailwind v4 config with the existing design tokens (`--brand`, `--ink`, fonts, radius).
2. Migrate component styles file-by-file using Tailwind utility classes.
3. Use `lucide-react` for all icons (replace raw Unicode symbols like `⠿`, `✦`, `⋯`, `←`).
4. Delete `index.css` once migration is complete.
5. Establish a `cn()` utility (`clsx` + `tailwind-merge`) for conditional classes.

---

### WMS-003 · Add proper state management — replace prop-drilling with TanStack Query

**Type:** Technical Debt  
**Priority:** High  
**Affects:** Entire frontend

**Problem**  
`@tanstack/react-query` is listed in `package.json` but never used. All API calls are raw `useEffect` + `useState` combos with no caching, deduplication, loading states, or error handling. The same data (`employees`, `services`, `reservations`) is fetched multiple times across separate components.

**Acceptance criteria**

1. Wrap `<App>` in `<QueryClientProvider>`.
2. Create typed query hooks for each API domain: `useWebsites`, `useEmployees`, `useServices`, `useReservations`, `usePages`.
3. Replace `useEffect(() => { void api.list().then(…) })` patterns throughout the codebase.
4. Add proper loading skeletons and error boundaries for every async view.
5. Invalidate relevant queries on mutations.

---

### WMS-004 · Token expiry, refresh, and automatic sign-out

**Type:** Bug  
**Priority:** Critical  
**Affects:** Auth

**Problem**  
JWT tokens expire in 8 hours (backend `AuthModule`). The frontend stores the token in `localStorage` and never checks expiry. After 8 hours every API call silently fails with 401 — the user sees no error and no redirect to login. There is no refresh token mechanism.

**Acceptance criteria**

1. Add an Axios response interceptor in `httpClient.ts` that catches 401 responses, clears the session, and redirects to login.
2. Decode the JWT on login, store `expiresAt`, and proactively sign the user out 1 minute before expiry using `setTimeout`.
3. Implement a `/api/auth/refresh` endpoint (backend) that issues a new short-lived access token from a long-lived HTTP-only cookie.
4. The frontend should transparently retry the original request after a successful refresh.

---

### WMS-005 · `TenantProvider` blocks the management workspace on every page load

**Type:** Bug  
**Priority:** Critical  
**Affects:** Management dashboard

**Problem**  
`TenantProvider` always calls `GET /api/websites/resolve?slug=…` on mount, even on `/manage` and `/admin`. If the hostname is `localhost`, the API returns 404 and the provider renders an error paragraph that **blocks the entire app**. The partial workaround (`isWorkspace` check) only covers exact paths `/manage` and `/admin`, not `/manage/websites/:id/*`.

**Acceptance criteria**

1. Skip the tenant resolution call when `pathname.startsWith('/manage') || pathname === '/admin'`.
2. Move tenant resolution into a page-level hook used only by public website pages.
3. Remove the `localStorage.setItem('studio-tenant', …)` side-effect from the provider — tenant should live in React state / React Query cache only.

---

## EPIC 2 — Onboarding & Step-Based Setup Wizard

---

### WMS-006 · Business & website creation onboarding wizard

**Type:** Feature  
**Priority:** Critical  
**Affects:** New user experience

**Problem**  
There is no onboarding flow. A new user who signs in lands on the WMS manager which immediately calls `GET /api/businesses` — if they have no business, they see a blank list. There is no guidance on what to do next. Creating a business and a website requires knowing the right buttons exist deep in the UI.

**Acceptance criteria**

1. After first sign-in, detect `businesses.length === 0` and redirect to `/onboarding`.
2. Create a multi-step wizard with the following steps:
   - **Step 1 — Business info:** Name, email, category (Salon, Studio, Spa, Other)
   - **Step 2 — Website setup:** Name, URL slug (live preview of final URL), category selection
   - **Step 3 — Template selection:** Visual picker for 3 starter themes (Editorial, Minimal, Playful) with live preview
   - **Step 4 — First module:** Enable at least one module (Agenda recommended). Explain each in plain language.
   - **Step 5 — Done:** Confetti animation, link to manage website and visit public URL
3. Persist progress to `localStorage` so the user can resume if interrupted.
4. Each step shows a visual progress indicator at the top.

---

### WMS-007 · Step-based "Getting Started" checklist inside the management dashboard

**Type:** Feature  
**Priority:** High  
**Affects:** Management dashboard

**Problem**  
After the wizard, a new user is dropped into the main dashboard with no guidance. They don't know the recommended order of operations (add employees → configure schedule → create services → build pages → publish).

**Acceptance criteria**

1. Add a persistent "Getting Started" card on the dashboard home showing a checklist:
   - ✅ Create your business (auto-checked after wizard)
   - ✅ Create your first website
   - ☐ Add at least one employee
   - ☐ Set employee availability
   - ☐ Create at least one service
   - ☐ Build your home page
   - ☐ Publish your website
2. Checklist items are checked dynamically based on API data.
3. Each item has a CTA button that navigates directly to the relevant section.
4. Checklist disappears once all items are checked, replaced by a "Your site is live" card.

---

## EPIC 3 — Agenda Module (Critical Bug Fixes)

---

### WMS-008 · Booking widget silently fails when no employee is selected

**Type:** Bug  
**Priority:** Critical  
**Affects:** `AgendaBookingWidget`

**Problem**  
In `AgendaBookingWidget`, the `useEffect` that fetches slots checks `if (!selectedResourceId) return` and shows the message "Select a nail artist first." — but the widget is already rendered **below** the employee list, meaning a user who hasn't clicked an employee can't see the booking form properly and gets no slot data. More critically, if `selectedResourceId` is undefined, `agendaApi.book()` is called without it and the backend call will silently fail (the endpoint requires `resourceId`).

**Acceptance criteria**

1. Disable the "Reserve Spot" button and all slot rendering when `selectedResourceId` is falsy.
2. Show a prominent "← Please select a nail artist above to see availability" banner within the widget itself.
3. Show a skeleton placeholder for slots while loading.
4. Slot fetch errors are surfaced to the user (network error, 400, 503).
5. After booking, auto-scroll to the confirmation message.

---

### WMS-009 · Agenda slot endpoint ignores the `X-Website-Id` header for public access

**Type:** Bug  
**Priority:** Critical  
**Affects:** `GET /api/agenda/slots`

**Problem**  
`SlotsAsync` requires both `tenant.BusinessId` and `tenant.WebsiteId` to be set, but `TenantResolutionMiddleware` only populates these from the `X-Business-Id` / `X-Website-Id` headers sent by the frontend. On the **public** website, these headers are populated from `localStorage` — but if `TenantProvider` failed to resolve (see WMS-005) or the user cleared storage, the headers are missing and the endpoint returns 400, showing no slots.

**Acceptance criteria**

1. The public booking widget must always send `X-Business-Id` and `X-Website-Id` (sourced from the resolved tenant).
2. `GET /api/agenda/slots` should accept the website `slug` as an optional query param as a fallback.
3. Add integration test: public slot request without auth headers but with `slug` param returns 200.

---

### WMS-010 · No calendar / day view for the manager — only raw reservation list

**Type:** Feature  
**Priority:** High  
**Affects:** `AgendaManagement` in `ManagementPages.tsx`

**Problem**  
The `AgendaManagement` page shows a date-range filter and a raw list of reservations. There is no visual calendar. Business owners cannot see their day at a glance: which hours are booked, which are free, which employee is doing what.

**Acceptance criteria**

1. Add a **week-view calendar** component showing time slots (08:00–20:00) for all active employees as columns.
2. Each reservation renders as a colored block in the appropriate column and time range.
3. Clicking a reservation opens a slide-over panel with full details (client name, service, time, status, notes).
4. Manager can drag a reservation to a new slot to reschedule (calls `PATCH /api/agenda/reservations/:id`).
5. Add a day/week toggle.
6. Color-code by reservation status: Pending=amber, Confirmed=green, Cancelled=grey, Completed=blue.

---

### WMS-011 · No confirmation email sent after booking

**Type:** Feature  
**Priority:** High  
**Affects:** Agenda module / Auth module

**Problem**  
When a customer books an appointment, nothing happens except a JSON response. No email is sent to the customer or the business owner. `SmtpEmailSender` exists but is only used for OTP codes.

**Acceptance criteria**

1. After `CreateReservationAsync` succeeds, publish a `ReservationCreatedIntegrationEvent`.
2. A new `NotificationModule` (or extend Auth) handles the event and sends:
   - Customer confirmation email with date, time, service, employee name.
   - Business owner notification email.
3. Templates are HTML emails with the business's brand color.
4. Failed email delivery must not fail the booking — use fire-and-forget with structured logging.
5. Add `PATCH /api/agenda/reservations/:id/cancel` triggers a cancellation email.

---

### WMS-012 · Employee schedule UX is broken — single button sets Mon–Fri 9–5 only

**Type:** Bug / Feature  
**Priority:** High  
**Affects:** `EmployeesManagement`

**Problem**  
In `ManagementPages.tsx`, the only way to set an employee's schedule is a hardcoded button: "Set Mon–Fri 09:00–17:00". There is no UI to set custom hours, add weekend availability, set breaks, or add date-specific overrides (holidays, vacations). The button calls `employeesApi.updateSchedule` which maps to the employee module, but `AgendaModule` has its own `ResourceAvailabilitySchedule` entity — the two are **disconnected**; the employee schedule update event (`EmployeeScheduleUpdatedIntegrationEvent`) is published but the `AgendaModule` has no handler for it.

**Acceptance criteria**

1. Build a proper weekly schedule editor: for each day (Mon–Sun), toggleable on/off, start time, end time, optional break window.
2. Wire `EmployeeScheduleUpdatedIntegrationEvent` handler in `AgendaModule` that upserts the `ResourceAvailabilitySchedule` for the resource.
3. Add a date-override editor: pick a date → mark as unavailable OR set custom hours.
4. Show a visual weekly calendar preview of the schedule.
5. Delete the hardcoded "Set Mon–Fri" button.

---

### WMS-013 · Reservation status can be set to invalid values from the management UI

**Type:** Bug  
**Priority:** Medium  
**Affects:** `AgendaManagement`

**Problem**  
In `AgendaManagement`, there is a `<select>` to change reservation status. The backend's `UpdateReservationAsync` only accepts `Pending`, `Confirmed`, or `Completed` — not `Cancelled`. Cancellation has a separate endpoint (`PATCH /reservations/:id/cancel`). The frontend uses `agendaApi.update()` which checks `patch.status === 'Cancelled'` and routes to the cancel endpoint, but the `<select>` in management does not include "Cancelled" as an option, leaving no way for managers to cancel from the UI.

**Acceptance criteria**

1. Add "Cancelled" to the status dropdown in the management view.
2. `agendaApi.update` already handles routing — confirm it works end-to-end.
3. Add a dedicated "Cancel" button with a confirmation dialog (not just a dropdown change).
4. Show a toast on successful status change.

---

## EPIC 4 — Page Builder / CMS

---

### WMS-014 · Page editor changes are lost on navigation — no auto-save

**Type:** Bug  
**Priority:** Critical  
**Affects:** `CanvasPageEditor`

**Problem**  
The `CanvasPageEditor` has a "Save draft" button that calls `PUT /api/websites/:id/pages/:pageId`. However:

- Adding/moving/deleting blocks only updates **local state** — they are not auto-saved.
- Navigating away (clicking a sidebar item) silently discards all unsaved changes.
- The "All changes saved" notice is hardcoded default text, not actual confirmation.

**Acceptance criteria**

1. Implement auto-save: debounce 1500 ms after any block change, then call the save API.
2. Show "Saving…" → "Saved just now" after auto-save completes.
3. Show "Unsaved changes" when there are pending changes.
4. Add a `beforeunload` warning when leaving with unsaved changes.
5. On navigation within the app, show a confirmation dialog: "You have unsaved changes. Leave anyway?"

---

### WMS-015 · Block inspector has no rich text editor — body is a plain `<textarea>`

**Type:** Feature  
**Priority:** High  
**Affects:** `CanvasPageEditor` / `block-inspector`

**Problem**  
The right-hand inspector panel only has a raw `<textarea>` for block body content. There is no formatting, no links, no lists. The public renderer just renders `{section.body}` as plain text — any HTML the user types would be shown as escaped text.

**Acceptance criteria**

1. Integrate a lightweight rich text editor (e.g. **Tiptap** or **Quill**) for the `text`, `hero`, `services`, and `contact` block types.
2. Store content as HTML string in `body`.
3. `PublicPageRenderer` renders the `body` with `dangerouslySetInnerHTML` with DOMPurify sanitization.
4. For `image` and `gallery` blocks: show a drag-and-drop upload zone instead of a plain file input.
5. For `hero` blocks: expose additional fields — CTA button label, CTA link, background image.

---

### WMS-016 · Canvas preview is not a real preview — just a list of block titles

**Type:** Feature  
**Priority:** High  
**Affects:** `CanvasPageEditor` / `page-canvas`

**Problem**  
The "canvas" in the middle of the page editor shows blocks as white boxes with a heading and body paragraph — identical to what a list would look like. There is no WYSIWYG rendering. The preview hero block gets a gradient background but that's it. Users cannot see what their page actually looks like.

**Acceptance criteria**

1. Each block type renders a faithful approximation of the public output inside the canvas (using the actual public components or close copies).
2. The canvas header shows the actual navigation bar from `ThemeConfig` (brand name + nav links).
3. Add a device-switcher toolbar: Desktop / Tablet / Mobile (changes the canvas `max-width`).
4. Add a full-page preview button that opens the public renderer in a right-side iframe using the real API data.

---

### WMS-017 · `PublicPageRenderer` returns "Loading page…" forever when website is not published

**Type:** Bug  
**Priority:** Critical  
**Affects:** `PublicPageRenderer`

**Problem**  
`ResolvePageAsync` on the backend checks `item.Status == "Published"` before returning data. If the website or page is in `Draft` status, the API returns 404. The frontend catches the error with `.catch(() => setResolved(null))` — but when `resolved` is `null` it renders `<p>Loading page…</p>` forever instead of a proper "not found" or "coming soon" message.

**Acceptance criteria**

1. Distinguish between a still-loading state (`null` before first fetch) and a failed/not-found state.
2. Show a proper 404 page with "This website is not available" when the API returns 404.
3. Show an error page with retry for network failures (500, timeout).
4. Add a "Coming Soon" placeholder page that managers can enable for draft websites.

---

### WMS-018 · Duplicate CMS systems — `CoreModule` (CmsPageSection) vs `BusinessModule` (WebsitePage)

**Type:** Technical Debt / Bug  
**Priority:** Critical  
**Affects:** Backend architecture

**Problem**  
There are **two completely separate CMS systems** in the backend:

1. `CoreModule` — `CmsPageSection` with `pageKey`, `contentJson`, stored in `studio_cms`
2. `BusinessModule` — `WebsitePage` with `sections: PageSection[]`, stored in `studio_business`

The frontend's `CanvasPageEditor` uses `BusinessModule`'s endpoints (`/api/websites/:id/pages`). The old `HeroSection` component and `cmsApi` use `CoreModule`'s endpoints (`/api/cms/pages/:key`). Both are served to the public — the `PublicPageRenderer` uses `BusinessModule`, while `ServiceCatalogList` uses `CoreModule` for services but `HeroSection` uses `CoreModule` for page sections. This causes split data, inconsistent state, and bugs.

**Acceptance criteria**

1. Deprecate and remove `CoreModule`'s `CmsPageSection` endpoints (`/api/cms/pages/:key`).
2. Migrate the `HeroSection` component to use `PublicPageRenderer` backed by `BusinessModule`.
3. Move `CatalogServiceItem` (services) from `CoreModule` to `BusinessModule` or a dedicated `ServicesModule`.
4. Remove `HeroSection` from `components.tsx` — it's replaced by the canvas page system.
5. Update all `cmsApi.page()` calls in the frontend to use the new unified API.

---

## EPIC 5 — Theme System

---

### WMS-019 · Theme system only supports color + font — needs full multi-theme support

**Type:** Feature  
**Priority:** High  
**Affects:** `ThemeManagement`, `TenantProvider`, `PublicPageRenderer`

**Problem**  
The current "theme" is just a primary color + font family set as CSS variables. There are no actual themes (the 3 template options shown in the onboarding wizard are never persisted or applied). The public website always renders with the same layout regardless of the chosen template.

**Acceptance criteria**

1. Define 3 theme configurations as code (layout variants): `editorial`, `minimal`, `playful`.
2. Each theme defines: header style (sticky / transparent overlay / solid), hero layout (full-bleed vs. centered), card style (rounded/flat/bordered), font pairing, default color palette.
3. Persist the chosen `themeId` in `WebsiteEntity.ThemeConfig`.
4. `TenantProvider` exposes `themeId` to the React tree.
5. `PublicPageRenderer` and all public components apply a CSS class (`theme-editorial`, etc.) on `<body>` that activates the right theme variant.
6. `ThemeManagement` page shows a live side-by-side preview of each theme.

---

### WMS-020 · Navigation editor requires manual pipe-separated text format

**Type:** Bug / UX  
**Priority:** High  
**Affects:** `ThemeManagement`

**Problem**  
In `ThemeManagement`, the navigation links input requires the format `Home|home, About|about`. This is a developer-only format not suitable for non-technical users. Typing errors (wrong separator, missing slug) silently corrupt navigation.

**Acceptance criteria**

1. Replace the raw text input with a dynamic list editor: each row has a "Label" text input and a "Page" dropdown (populated from the website's pages via API).
2. Add "Add link" and "Remove" buttons per row.
3. Drag-to-reorder rows.
4. Auto-generate slug from label when the user creates a new page via the dropdown "Create new page…" option.
5. Validate that all selected slugs correspond to published pages.

---

## EPIC 6 — Employees Module

---

### WMS-021 · Employee avatar upload not implemented

**Type:** Feature  
**Priority:** Medium  
**Affects:** `EmployeesManagement`

**Problem**  
`EmployeeProfile` has an `avatarUrl` field. The management UI has no way to upload an avatar — the field is never shown. The public `NailistsShowcase` renders `{employee.avatarUrl && <img>}` so it gracefully degrades, but the first-letter avatar is not styled for the list view.

**Acceptance criteria**

1. Add an avatar upload field to the "Add employee" form and the employee edit panel.
2. Reuse the existing `POST /api/assets` endpoint.
3. Show a circular preview of the uploaded image.
4. The management card shows the avatar image if available, else the initials circle.
5. Add an "Edit" button per employee card that opens an edit panel (currently no editing is possible — only archive/restore).

---

### WMS-022 · Employee skill tags have no management UI

**Type:** Feature  
**Priority:** Medium  
**Affects:** `EmployeesManagement`

**Problem**  
`EmployeeProfile.SkillTags` is a `List<string>` on the backend. In `NailistsShowcase`, skill tags are rendered as `employee.skillTags.join(' · ')`. But in `EmployeesManagement`, there is no UI to add or remove skill tags. The "Add employee" form sends an empty `skillTags: []`.

**Acceptance criteria**

1. Add a tag-input component to the employee form (type tag → press Enter or comma to add, click × to remove).
2. Show existing tags as removable chips in the edit panel.
3. Persist via `PUT /api/employees/:id`.

---

## EPIC 7 — Customers Module

---

### WMS-023 · Customer list has no pagination UI, no search bar in the management view

**Type:** Bug  
**Priority:** Medium  
**Affects:** `CustomersManagement`

**Problem**  
The backend `GET /api/customers` endpoint supports `search`, `page`, and `pageSize` query params with proper pagination. The frontend `CustomersManagement` component doesn't pass any of these — it always fetches all customers with no pagination and renders them all in a list with no search box visible to the manager.

**Acceptance criteria**

1. Add a search input at the top of the customers page. Debounce 300 ms before calling the API with `?search=`.
2. Add pagination controls at the bottom (previous/next, page number, total count).
3. Default `pageSize` is 25.
4. Show a "No customers found" empty state with the search query echoed back.
5. Add a customer detail side panel that shows the customer's reservation history.

---

### WMS-024 · `CustomerProfileDrawer` renders field names as labels (raw code)

**Type:** Bug  
**Priority:** Medium  
**Affects:** `CustomerProfileDrawer`

**Problem**

```tsx
{Object.keys(form).map((field) => (
  <label key={field}>{field}<input …/></label>
))}
```

This renders the raw JavaScript property names (`firstName`, `lastName`, `consentMarketing`) as visible labels. Users see "firstName" instead of "First name".

**Acceptance criteria**

1. Replace `Object.keys(form).map` with explicit, labeled fields.
2. Use proper `<label>` / `<input>` pairs with human-readable labels.
3. Add a "Marketing consent" checkbox (mapped to `ConsentMarketing`).
4. Show the customer's upcoming reservations in the drawer.
5. Add input validation (phone number format, required first name).

---

## EPIC 8 — Services Module

---

### WMS-025 · Services are not scoped to the active website

**Type:** Bug  
**Priority:** High  
**Affects:** `ServicesManagement`, `CoreModule`

**Problem**  
`CoreModule`'s `GET /api/catalog/services` is scoped to `BusinessId + WebsiteId`. The frontend `cmsApi.services()` hits this endpoint correctly (headers are set). However, when creating services via `cmsApi.createService()`, `WebsiteId` comes from `X-Website-Id` header. The `ManagementPages.tsx` `ServicesManagement` component doesn't receive the `websiteId` prop — it relies entirely on the HTTP header, which requires the `TenantProvider` to have already resolved the tenant. If a manager creates a service while `X-Website-Id` is not set (e.g. TenantProvider failure, WMS-005), the service is created with a zero GUID `WebsiteId` and never appears in the list.

**Acceptance criteria**

1. `ServicesManagement` must receive `websiteId` as a prop and pass it explicitly in the API layer.
2. Add validation in `CoreModule.CreateServiceAsync`: reject if `websiteId` is `Guid.Empty`.
3. Services list must show which website each service belongs to when viewed at the business level.
4. Add service categories as a selectable dropdown (not a free-text field).
5. Add service image upload (reuse `/api/assets`).

---

### WMS-026 · No service ↔ employee assignment

**Type:** Feature  
**Priority:** High  
**Affects:** Agenda, Employees, Services

**Problem**  
Currently, any employee can technically be booked for any service because there is no assignment between the two. On the public site, a customer selects a service, then an employee — but the system doesn't filter employees by what services they offer. An employee might not offer a specific service at all.

**Acceptance criteria**

1. Add `ServiceIds: List<Guid>` to `EmployeeProfile`.
2. In `EmployeesManagement`, add a multi-select checklist of available services per employee.
3. `GET /api/employees/public?serviceId=` should filter employees who offer that service.
4. The booking widget: after selecting a service, only show employees who offer it.
5. Display the service name and duration on the employee card in the booking widget.

---

## EPIC 9 — Management UX & General Improvements

---

### WMS-027 · Management sidebar navigation has no active state

**Type:** Bug  
**Priority:** Medium  
**Affects:** `ManagementFrame`

**Problem**  
In `ManagementFrame`, nav items are `<button>` elements with `onClick={() => navigate(path)}`. None of them have an `active` CSS class — the `.nav-item.active` CSS rule exists in the stylesheet but is never applied. Users cannot tell which section they are in.

**Acceptance criteria**

1. Compare current `pathname` to each nav item's path and apply the `active` class.
2. Use `NavLink` from React Router (after WMS-001) which handles this automatically.
3. Add icons (from `lucide-react`) next to each nav label.
4. Highlight the active item with the brand color indicator (already defined in CSS as `box-shadow: inset 3px 0 #e0a68d`).

---

### WMS-028 · Workspace search is keyword-matching only — not actually searching data

**Type:** Bug / Feature  
**Priority:** Low  
**Affects:** `WorkspaceSearch`

**Problem**  
`WorkspaceSearch` in the topbar only performs keyword → route mapping using `string.includes()`. It doesn't actually search customers, employees, pages, or services by name. Typing "John" routes to `/customers` but doesn't filter for John.

**Acceptance criteria**

1. Replace with a proper command palette (⌘K / Ctrl+K shortcut).
2. Searching returns categorized results: Pages, Employees, Customers, Services, Reservations.
3. Each result type calls the respective API (with 300 ms debounce).
4. Clicking a result navigates to the item's detail view.
5. Include keyboard navigation (↑/↓ arrows, Enter to select, Esc to close).

---

### WMS-029 · `window.confirm()` used for destructive actions — not a production UX pattern

**Type:** Bug / UX  
**Priority:** Medium  
**Affects:** `CanvasPageEditor`, various

**Problem**  
`CanvasPageEditor.deletePage()` uses `window.confirm(…)` which renders the browser's native dialog — styled differently on every OS, blocks the thread, and cannot be styled. Multiple other places inline-confirm with no dialog at all.

**Acceptance criteria**

1. Build a reusable `<ConfirmDialog>` component using the HTML `<dialog>` element.
2. Replace all `window.confirm()` calls.
3. Dialog must show: action title, description of what will be deleted, "Cancel" and "Delete" (red) buttons.
4. Focus is trapped inside the dialog when open (accessibility).

---

### WMS-030 · No toast / notification system — success and error messages are inline paragraphs

**Type:** Feature  
**Priority:** Medium  
**Affects:** Entire frontend

**Problem**  
Feedback messages are rendered as `<p className="notice">` or `<div className="toast">` inline in forms. They don't auto-dismiss, they aren't positioned consistently, and multiple simultaneous messages can break the layout.

**Acceptance criteria**

1. Create a `<ToastProvider>` + `useToast()` hook.
2. Toasts appear in the bottom-right corner, stack vertically.
3. Auto-dismiss after 4 seconds (success) or 8 seconds (error).
4. Support variants: `success` (green), `error` (red), `info` (blue), `warning` (amber).
5. Each toast has a manual close button.
6. Replace all inline `{message && <p>…</p>}` patterns.

---

## EPIC 10 — Backend & Infrastructure

---

### WMS-031 · `weatherforecast` placeholder endpoint still in production code

**Type:** Technical Debt  
**Priority:** Low  
**Affects:** `Program.cs`

**Problem**  
`Program.cs` still includes the template `GET /weatherforecast` endpoint from the `dotnet new` scaffold. It is exposed publicly.

**Acceptance criteria**

1. Delete the `WeatherForecast` record and its endpoint from `Program.cs`.
2. Delete the `WeatherForecast` tests if any exist.

---

### WMS-032 · Asset upload saves files to local disk — not suitable for production

**Type:** Bug / Feature  
**Priority:** High  
**Affects:** `UploadAssetAsync` in `BusinessModule`

**Problem**  
Uploaded images are saved to `{ContentRootPath}/uploads/` and served via `UseStaticFiles`. In Docker, this means files are lost when the container is replaced. In production (multi-instance), each instance has its own disk, so files uploaded to instance A are not visible on instance B.

**Acceptance criteria**

1. Add an `IAssetStorage` interface with `UploadAsync(stream, filename, contentType) → string url`.
2. Implement `LocalAssetStorage` for development (current behavior).
3. Implement `S3AssetStorage` / `AzureBlobStorage` for production (configurable via `appsettings`).
4. Register the correct implementation based on `ASPNETCORE_ENVIRONMENT` or a config flag.
5. Return CDN-fronted URLs in production.

---

### WMS-033 · No MongoDB indexes defined — queries scan entire collections

**Type:** Bug  
**Priority:** High  
**Affects:** Backend performance

**Problem**  
Only `CustomerModule` defines a MongoDB index (email + businessId unique). All other collections (`Reservation`, `WebsitePage`, `EmployeeProfile`, `ResourceAvailabilitySchedule`) have no indexes. As data grows, queries like "find all reservations for businessId + websiteId between dates" will become full collection scans.

**Acceptance criteria**

1. Create a `MongoIndexInitializer` hosted service in `Shared`.
2. Define compound indexes for:
   - `Reservation`: `(BusinessId, WebsiteId, ResourceId, StartAtUtc)` + `(BusinessId, ClientId)`
   - `ResourceAvailabilitySchedule`: `(BusinessId, WebsiteId, ResourceId)` unique
   - `EmployeeProfile`: `(BusinessId, Email)` unique
   - `WebsitePage`: `(WebsiteId, Slug)` unique
   - `WebsiteEntity`: `(DomainOrSlug)` unique
3. Add unit test that verifies each index exists after seeder runs.

---

### WMS-034 · `ReservationService` double-books when concurrent requests arrive

**Type:** Bug  
**Priority:** High  
**Affects:** `AgendaModule` / `ReservationService`

**Problem**  
`CreateAsync` in `ReservationService` checks for conflicting reservations using `FindAsync`, then inserts. Between the check and the insert, a second concurrent request can pass the check and also insert — causing double-booking. MongoDB has no built-in transaction for this pattern in the current implementation.

**Acceptance criteria**

1. Use MongoDB's unique compound index on `(ResourceId, StartAtUtc, Status ≠ Cancelled)` to enforce uniqueness at the database level.
2. Catch the `MongoWriteException` (duplicate key error) in `CreateAsync` and return `null` (already triggers `Results.Conflict` in the endpoint).
3. Alternatively, use a distributed lock via Redis (`SETNX`) for the `(resourceId, slotStart)` key during the check-then-insert window.
4. Add a load test proving concurrent booking attempts for the same slot result in exactly one success.

---

### WMS-035 · No CORS configuration — frontend and backend on different origins will fail

**Type:** Bug  
**Priority:** Critical  
**Affects:** `Program.cs`

**Problem**  
`Program.cs` has no `app.UseCors()` call. In Docker Compose, the frontend is served on port 3000 and the API is on a different internal port. Any browser-initiated request from the frontend domain to the API domain will be blocked by the browser's CORS policy. The current setup accidentally works because Nginx proxies `/api` to the backend (per `frontend.nginx.conf`) — but this means the app only works in Docker, not in development (`npm run dev`).

**Acceptance criteria**

1. Add `builder.Services.AddCors()` with a named policy allowing the frontend origin.
2. Read allowed origins from `appsettings.json` (`Cors:AllowedOrigins`).
3. In development, allow `http://localhost:5173` (Vite dev server).
4. In production, allow only the actual domain.
5. Update `vite.config.ts` to proxy `/api` to `http://localhost:5XXX` for local development so developers don't need Docker.

---

### WMS-036 · JWT secret is hardcoded in `docker-compose.yml` and `Program.cs`

**Type:** Security  
**Priority:** Critical  
**Affects:** `Program.cs`, `docker-compose.yml`

**Problem**  
`"development-only-secret-change-me-please-32chars"` is used as the JWT secret fallback in `Program.cs` and is also hardcoded in `docker-compose.yml`. This secret is committed to the repository and if anyone runs the Docker image in production with the default secret, JWTs signed with this key can be forged.

**Acceptance criteria**

1. Remove the fallback string from `Program.cs` — throw `InvalidOperationException` if `Jwt:Secret` is not configured.
2. Add `Jwt:Secret` to a `.env.example` file (not `.env`) with instructions.
3. Add `.env` to `.gitignore`.
4. Update `docker-compose.yml` to read `JWT_SECRET` from the environment: `Jwt__Secret: ${JWT_SECRET}`.
5. Document the required env vars in `README.md`.

---

## EPIC 11 — Testing & Quality

---

### WMS-037 · Frontend has zero tests

**Type:** Technical Debt  
**Priority:** High  
**Affects:** Frontend

**Problem**  
There are no frontend tests of any kind. No unit tests, no component tests, no E2E tests. The only tests in the project are `InMemoryEventBusTests.cs` on the backend.

**Acceptance criteria**

1. Set up **Vitest** + **React Testing Library**.
2. Write unit tests for:
   - `AgendaBookingWidget` — renders slot list, disables book when no slot selected, calls `agendaApi.book` on submit
   - `PasswordlessLoginForm` — OTP input auto-advances, paste fills all 6 digits, error state renders
   - `CanvasPageEditor` — add block, move block, delete block update local state
3. Write integration tests with **MSW** (mock service worker) mocking the API.
4. Set up **Playwright** for E2E: happy-path booking flow, manager login → create service → publish page.
5. Add test coverage to CI pipeline.

---

### WMS-038 · Backend has no integration tests — only 1 unit test

**Type:** Technical Debt  
**Priority:** High  
**Affects:** Backend

**Problem**  
`InMemoryEventBusTests.cs` is the only backend test. There are no integration tests for any endpoint, no tests for `AvailabilityCalculator`, and no tests for `RedisOtpService`.

**Acceptance criteria**

1. Add **xUnit** integration test project using `WebApplicationFactory<Program>`.
2. Use `Testcontainers` for MongoDB and Redis (or an in-memory substitute).
3. Write integration tests covering:
   - Auth flow: request code → verify code → get valid JWT
   - Booking flow: create employee → set schedule → fetch slots → book reservation
   - Conflict detection: two concurrent bookings for the same slot
   - Page CRUD: create → update → publish → resolve via slug
4. Target ≥ 80% branch coverage on all module handlers.

---

## Summary Table

| #       | Title                                  | Priority    | Epic           | Status       |
| ------- | -------------------------------------- | ----------- | -------------- | ------------ |
| WMS-001 | React Router integration               | 🔴 Critical | Architecture   | ✅ Completed |
| WMS-002 | Tailwind migration                     | 🟠 High     | Architecture   | ✅ Completed |
| WMS-003 | TanStack Query integration             | 🟠 High     | Architecture   | ✅ Completed |
| WMS-004 | Token expiry & auto sign-out           | 🔴 Critical | Auth           | ✅ Completed |
| WMS-005 | TenantProvider blocks management       | 🔴 Critical | Architecture   | ✅ Completed |
| WMS-006 | Onboarding wizard                      | 🔴 Critical | Onboarding     | ✅ Completed |
| WMS-007 | Getting Started checklist              | 🟠 High     | Onboarding     | ✅ Completed |
| WMS-008 | Booking widget silent fail             | 🔴 Critical | Agenda         | ✅ Completed |
| WMS-009 | Slots endpoint missing tenant          | 🔴 Critical | Agenda         | ✅ Completed |
| WMS-010 | Calendar week view                     | 🟠 High     | Agenda         | ✅ Completed |
| WMS-011 | Booking confirmation email             | 🟠 High     | Agenda         | ✅ Completed |
| WMS-012 | Employee schedule UX broken            | 🟠 High     | Employees      | ✅ Completed |
| WMS-013 | Invalid reservation status             | 🟡 Medium   | Agenda         | ✅ Completed |
| WMS-014 | Page editor no auto-save               | 🔴 Critical | CMS            | ✅ Completed |
| WMS-015 | No rich text editor                    | 🟠 High     | CMS            | ✅ Completed |
| WMS-016 | Canvas not a real preview              | 🟠 High     | CMS            | ✅ Completed |
| WMS-017 | PublicPageRenderer stuck on Loading    | 🔴 Critical | CMS            | ✅ Completed |
| WMS-018 | Duplicate CMS systems                  | 🔴 Critical | Backend        | ✅ Completed |
| WMS-019 | Theme multi-template support           | 🟠 High     | Themes         | ✅ Completed |
| WMS-020 | Navigation editor UX                   | 🟠 High     | Themes         | ✅ Completed |
| WMS-021 | Employee avatar upload                 | 🟡 Medium   | Employees      | ✅ Completed |
| WMS-022 | Skill tags management UI               | 🟡 Medium   | Employees      | ✅ Completed |
| WMS-023 | Customer list pagination & search      | 🟡 Medium   | Customers      | ✅ Completed |
| WMS-024 | CustomerProfileDrawer raw field names  | 🟡 Medium   | Customers      | ✅ Completed |
| WMS-025 | Services website scoping bug           | 🟠 High     | Services       | ✅ Completed |
| WMS-026 | Service ↔ employee assignment          | 🟠 High     | Services       | ✅ Completed |
| WMS-027 | Sidebar no active state                | 🟡 Medium   | UX             | ✅ Completed |
| WMS-028 | Workspace search not real search       | 🔵 Low      | UX             | ✅ Completed |
| WMS-029 | window.confirm for destructive actions | 🟡 Medium   | UX             | ✅ Completed |
| WMS-030 | No toast notification system           | 🟡 Medium   | UX             | ✅ Completed |
| WMS-031 | weatherforecast placeholder in prod    | 🔵 Low      | Backend        | ✅ Completed |
| WMS-032 | Asset upload local disk only           | 🟠 High     | Infrastructure | ✅ Completed |
| WMS-033 | No MongoDB indexes                     | 🟠 High     | Backend        | ✅ Completed |
| WMS-034 | Double-booking race condition          | 🟠 High     | Agenda         | ✅ Completed |
| WMS-035 | No CORS configuration                  | 🔴 Critical | Backend        | ✅ Completed |
| WMS-036 | JWT secret hardcoded                   | 🔴 Critical | Security       | ✅ Completed |
| WMS-037 | Frontend has zero tests                | 🟠 High     | Testing        | ✅ Completed |
| WMS-038 | Backend has 1 test                     | 🟠 High     | Testing        | ✅ Completed |
