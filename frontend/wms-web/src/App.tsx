import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
  Link,
  NavLink,
  Outlet,
} from "react-router-dom";
import {
  ArrowRight,
  Plus,
  Sparkles,
  Layers,
  FileText,
  Settings,
} from "lucide-react";
import { AgendaBookingWidget } from "@modules/agenda";
import { PasswordlessLoginModal } from "@modules/auth";
import { CustomerProfileDrawer } from "@modules/customers";
import { NailistsShowcase, type EmployeeProfile } from "@modules/employees";
import { ServiceCatalogList, type CatalogService } from "@modules/cms";
import { CanvasPageEditor } from "@modules/cms/CanvasPageEditor";
import { PublicPageRenderer } from "@modules/cms/PublicPageRenderer";
import {
  AgendaManagement,
  CustomersManagement,
  EmployeesManagement,
  ModulesManagement,
  ServicesManagement,
  ThemeManagement,
} from "./pages/ManagementPages";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { GettingStartedCard } from "@shared/ui/GettingStartedCard";
import { httpClient } from "@shared/api/httpClient";
import { useAuth } from "@shared/auth/AuthProvider";
import { AuthGuard } from "@shared/auth/AuthGuard";
import {
  TenantProvider,
  useTenant,
  useTenantTheme,
} from "@shared/tenancy/TenantProvider";
import { useBusinesses, useCreateWebsite } from "@shared/queries";
import { useToast } from "@shared/ui/Toast";
import { WorkspaceSearch } from "@shared/ui/CommandPalette";
import { ManagementFrame } from "@shared/layout/ManagementFrame";

const templates = [
  {
    id: "editorial",
    name: "Editorial Studio",
    description: "Bold typography and an elegant editorial layout.",
    color: "#b77962",
  },
  {
    id: "minimal",
    name: "Minimal Atelier",
    description: "Quiet, refined, and focused on your services.",
    color: "#9b8b7a",
  },
  {
    id: "playful",
    name: "Playful Pop",
    description: "Bright, expressive, and made for modern brands.",
    color: "#c26d8b",
  },
];

function ProfileOnboarding({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    line1: "",
    city: "",
    postalCode: "",
    country: "",
  });
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await httpClient.put("/api/onboarding/profile", {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        address: {
          line1: form.line1,
          city: form.city,
          postalCode: form.postalCode,
          country: form.country,
        },
      });
      toast.success("Profile created successfully.");
      onComplete();
    } catch {
      toast.error("Failed to save profile. Please check your inputs.");
    }
  }

  const update =
    (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: event.target.value });

  return (
    <section className="card onboarding">
      <h1>Tell us about you</h1>
      <p>Complete your profile before creating your first website/business.</p>
      <form onSubmit={(event) => void submit(event)}>
        {(
          [
            "firstName",
            "lastName",
            "phone",
            "line1",
            "city",
            "postalCode",
            "country",
          ] as const
        ).map((key) => (
          <input
            key={key}
            required={key === "firstName" || key === "lastName"}
            placeholder={key}
            value={form[key]}
            onChange={update(key)}
          />
        ))}
        <button type="submit">Continue</button>
      </form>
    </section>
  );
}

function WmsWorkspaceLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { data: businesses = [], isLoading, refetch } = useBusinesses();
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [profileReady, setProfileReady] = useState<boolean | null>(null);

  useState(() => {
    if (user?.roles.includes("Developer")) {
      setProfileReady(true);
    } else {
      httpClient
        .get("/api/onboarding/profile")
        .then(() => setProfileReady(true))
        .catch(() => setProfileReady(false));
    }
  });

  const currentBusinessId = selectedBusiness || businesses[0]?.id || "";

  if (profileReady === null || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-stone-500">
        <p>Loading your WMS workspace…</p>
      </div>
    );
  }

  // WMS-006: In src/App.tsx, after sign-in, if businesses.length === 0, redirect to /onboarding.
  if (businesses.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!profileReady) {
    return (
      <ProfileOnboarding
        onComplete={() => {
          setProfileReady(true);
          void refetch();
        }}
      />
    );
  }

  const getPageTitle = () => {
    if (location.pathname === "/manage/websites") return "Your websites";
    if (location.pathname === "/manage/websites/new") return "New website";
    if (location.pathname === "/manage/settings") return "Account settings";
    return "Your websites";
  };

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span>WMS</span>
        </div>
        <p className="eyebrow">Account</p>
        <select
          className="switcher"
          value={currentBusinessId}
          onChange={(event) => {
            const bId = event.target.value;
            setSelectedBusiness(bId);
            const activeBiz = businesses.find((b) => b.id === bId);
            const firstWeb = activeBiz?.websites[0];
            if (firstWeb) {
              localStorage.setItem(
                "studio-tenant",
                JSON.stringify({ businessId: bId, websiteId: firstWeb.id }),
              );
            }
          }}
        >
          <option value="">Choose website</option>
          {businesses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <nav aria-label="Account sections">
          <NavLink
            to="/manage"
            end
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>Overview</span>
          </NavLink>
          <NavLink
            to="/manage/websites"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Websites</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <NavLink
            to="/manage/settings"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Account settings</span>
          </NavLink>
          <button type="button" className="profile-chip" onClick={signOut}>
            <span className="avatar">{user?.email?.[0].toUpperCase()}</span>
            <span>{user?.email}</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Account</p>
            <h1>{getPageTitle()}</h1>
          </div>
          <div className="top-actions">
            <WorkspaceSearch />
            <button className="button secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <div className="workspace-content">
          <Outlet
            context={{ businesses, selectedBusiness: currentBusinessId }}
          />
        </div>
      </section>
    </main>
  );
}

function WorkspaceOverview() {
  const navigate = useNavigate();
  const { data: businesses = [] } = useBusinesses();
  const totalWebsites = businesses.reduce(
    (count, item) => count + item.websiteCount,
    0,
  );
  const publishedWebsites = businesses
    .flatMap((item) => item.websites)
    .filter((item) => item.status === "Published").length;
  const firstWebsite = businesses[0]?.websites[0];

  return (
    <>
      <section className="welcome-panel mb-6">
        <div>
          <p className="eyebrow">Your digital studio</p>
          <h2>Build beautiful websites, without the busywork.</h2>
          <p>
            Create, customize, and publish every website your businesses need
            from one calm workspace.
          </p>
          <button
            className="button primary inline-flex items-center gap-1.5"
            onClick={() => navigate("/manage/websites/new")}
          >
            Create a website
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="welcome-orb">
          <Sparkles className="w-16 h-16 text-[#e0a68d]" />
        </div>
      </section>

      {/* WMS-007: Persistent Getting Started card on dashboard home */}
      <GettingStartedCard website={firstWebsite} />

      <div className="stat-grid">
        <div className="stat-card">
          <span>Businesses</span>
          <strong>{businesses.length}</strong>
        </div>
        <div className="stat-card">
          <span>Websites</span>
          <strong>{totalWebsites}</strong>
        </div>
        <div className="stat-card">
          <span>Published</span>
          <strong>{publishedWebsites}</strong>
        </div>
      </div>
    </>
  );
}

function AccountSettings() {
  const { user } = useAuth();
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Account settings</p>
          <h2>Account access</h2>
        </div>
      </div>
      <div className="card">
        <p>
          Your account manages websites directly. Select a website from the
          Websites screen to edit its design, content, team, customers,
          services, and agenda.
        </p>
        <strong>{user?.email}</strong>
      </div>
    </section>
  );
}

function WebsitesList() {
  const navigate = useNavigate();
  const { data: businesses = [] } = useBusinesses();

  const openWebsite = (websiteId: string, destination: string) => {
    navigate(`/manage/websites/${websiteId}/${destination}`);
  };

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Manage your presence</p>
          <h2>Websites</h2>
        </div>
        <button
          className="button primary inline-flex items-center gap-1.5"
          onClick={() => navigate("/manage/websites/new")}
        >
          <Plus className="w-4 h-4" />
          New website
        </button>
      </div>
      <div className="website-grid">
        {businesses
          .flatMap((item) => item.websites)
          .map((item) => (
            <article className="website-card" key={item.id}>
              <div
                className="website-preview"
                style={{
                  background:
                    item.status === "Published" ? "#e7d8d0" : "#eceaf0",
                }}
              >
                <span>{item.category}</span>
                <strong>{item.name}</strong>
              </div>
              <div className="website-card-body">
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    /{item.domainOrSlug} ·{" "}
                    <span className={`status ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </p>
                </div>
                <button
                  className="button small primary"
                  onClick={() => openWebsite(item.id, "pages")}
                >
                  Manage website
                </button>
              </div>
              <div className="website-card-actions">
                <button
                  className="button small secondary"
                  onClick={() => openWebsite(item.id, "pages")}
                >
                  Pages
                </button>
                <button
                  className="button small secondary"
                  onClick={() => openWebsite(item.id, "theme")}
                >
                  Theme
                </button>
                <button
                  className="button small secondary"
                  onClick={() => openWebsite(item.id, "customers")}
                >
                  Customers
                </button>
                <button
                  className="button small secondary"
                  onClick={() => openWebsite(item.id, "employees")}
                >
                  Employees
                </button>
                <button
                  className="button small secondary"
                  onClick={() => openWebsite(item.id, "services")}
                >
                  Services
                </button>
                <button
                  className="button small secondary"
                  onClick={() => openWebsite(item.id, "agenda")}
                >
                  Agenda
                </button>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

function NewWebsiteBuilder() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: businesses = [] } = useBusinesses();
  const createMutation = useCreateWebsite();

  const [template, setTemplate] = useState(templates[0].id);
  const [website, setWebsite] = useState({
    name: "",
    slug: "",
    category: "Nail studio",
    color: "#c26d8b",
    heroText: "",
  });
  const [modules, setModules] = useState([
    "cms",
    "customers",
    "employees",
    "agenda",
  ]);

  const firstBusinessId = businesses[0]?.id ?? "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firstBusinessId) {
      toast.error("No business account found to create website under.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: website.name,
        domainOrSlug: website.slug,
        templateId: template,
        category: website.category,
        enabledModules: modules,
        themeConfig: { primaryColor: website.color, themeId: template },
        content: { title: website.name, heroText: website.heroText },
      });
      toast.success("Website created as a draft.");
      navigate("/manage/websites");
    } catch {
      toast.error(
        "Could not create website. Please check the slug and details.",
      );
    }
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Start with a foundation</p>
          <h2>Choose a template</h2>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("/manage/websites")}
        >
          Cancel
        </button>
      </div>

      <div className="template-grid">
        {templates.map((item) => (
          <button
            key={item.id}
            className={`template-card ${template === item.id ? "chosen" : ""}`}
            onClick={() => setTemplate(item.id)}
          >
            <div className="template-art" style={{ background: item.color }}>
              <Sparkles className="w-8 h-8" />
              <strong>{item.name}</strong>
            </div>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
          </button>
        ))}
      </div>

      <form className="builder-form" onSubmit={(e) => void handleSubmit(e)}>
        <h3>Website details</h3>
        <div className="form-grid">
          <input
            required
            placeholder="Website name"
            value={website.name}
            onChange={(event) =>
              setWebsite({ ...website, name: event.target.value })
            }
          />
          <input
            required
            placeholder="WMS slug"
            value={website.slug}
            onChange={(event) =>
              setWebsite({
                ...website,
                slug: event.target.value.toLowerCase().replace(/\s+/g, "-"),
              })
            }
          />
          <input
            placeholder="Category"
            value={website.category}
            onChange={(event) =>
              setWebsite({ ...website, category: event.target.value })
            }
          />
          <input
            placeholder="Hero text"
            value={website.heroText}
            onChange={(event) =>
              setWebsite({ ...website, heroText: event.target.value })
            }
          />
        </div>
        <label className="color-field">
          Brand color{" "}
          <input
            type="color"
            value={website.color}
            onChange={(event) =>
              setWebsite({ ...website, color: event.target.value })
            }
          />
        </label>
        <fieldset>
          <legend>Website modules</legend>
          <div className="module-options">
            {["cms", "customers", "employees", "agenda"].map((module) => (
              <label key={module}>
                <input
                  type="checkbox"
                  checked={modules.includes(module)}
                  onChange={() =>
                    setModules(
                      modules.includes(module)
                        ? modules.filter((item) => item !== module)
                        : [...modules, module],
                    )
                  }
                />{" "}
                <span>{module}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          className="button primary"
          disabled={!firstBusinessId || createMutation.isPending}
        >
          {createMutation.isPending ? "Creating…" : "Create draft website"}
        </button>
      </form>
    </section>
  );
}

function WebsiteDashboardOverview({
  website,
}: {
  website: { id: string; name: string; domainOrSlug: string; status: string };
}) {
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Website Overview</p>
          <h2>{website.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/sites/${website.domainOrSlug}`}
            target="_blank"
            rel="noreferrer"
            className="button secondary inline-flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <span>Visit website</span>
          </a>
        </div>
      </div>
      <GettingStartedCard websiteId={website.id} />
    </section>
  );
}

function WebsiteManagementRoutes() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  const { data: businesses = [], refetch } = useBusinesses();

  const activeWebsite = businesses
    .flatMap((item) => item.websites)
    .find((item) => item.id === websiteId);

  if (!activeWebsite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-stone-500">
        <div className="text-center space-y-4">
          <p>Website not found or loading…</p>
          <button
            className="button secondary"
            onClick={() => navigate("/manage/websites")}
          >
            Back to websites
          </button>
        </div>
      </div>
    );
  }

  // Update localStorage tenant headers for this active website
  try {
    localStorage.setItem(
      "studio-tenant",
      JSON.stringify({
        businessId: activeWebsite.businessId,
        websiteId: activeWebsite.id,
      }),
    );
  } catch {
    // Ignore storage issues
  }

  return (
    <Routes>
      <Route
        path="pages"
        element={
          <CanvasPageEditor
            websiteId={activeWebsite.id}
            websiteName={activeWebsite.name}
            website={activeWebsite}
            onBack={() => navigate("/manage/websites")}
          />
        }
      />
      <Route
        element={
          <ManagementFrame
            website={activeWebsite}
            onBack={() => navigate("/manage/websites")}
          />
        }
      >
        <Route index element={<WebsiteDashboardOverview website={activeWebsite} />} />
        <Route
          path="overview"
          element={<WebsiteDashboardOverview website={activeWebsite} />}
        />
        <Route
          path="theme"
          element={
            <ThemeManagement
              website={activeWebsite}
              onSaved={() => {
                void refetch();
              }}
            />
          }
        />
        <Route
          path="modules"
          element={
            <ModulesManagement
              website={activeWebsite}
              onSaved={() => {
                void refetch();
              }}
            />
          }
        />
        <Route path="services" element={<ServicesManagement websiteId={activeWebsite.id} />} />
        <Route
          path="customers"
          element={<CustomersManagement websiteId={activeWebsite.id} />}
        />
        <Route
          path="employees"
          element={<EmployeesManagement websiteId={activeWebsite.id} />}
        />
        <Route path="agenda" element={<AgendaManagement />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>
    </Routes>
  );
}

function PublicWebsiteRoute() {
  const { slug, "*": splat } = useParams<{ slug: string; "*": string }>();
  const pageSlug = splat || "home";

  return (
    <TenantProvider slug={slug}>
      <PublicWebsiteView slug={slug ?? ""} pageSlug={pageSlug} />
    </TenantProvider>
  );
}

function PublicWebsiteView({
  slug,
  pageSlug,
}: {
  slug: string;
  pageSlug: string;
}) {
  const tenant = useTenant();
  const { theme, themeId } = useTenantTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [service, setService] = useState<CatalogService | null>(null);
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);

  const navItems = tenant?.content?.navigation?.items?.length
    ? tenant.content.navigation.items
    : [{ label: "Home", pageSlug: "home" }];

  const headerClass =
    theme.headerStyle === "sticky"
      ? "public-header sticky top-0 z-30 backdrop-blur-md bg-white/85 shadow-xs"
      : theme.headerStyle === "transparent"
        ? "public-header absolute top-0 left-0 right-0 z-30 bg-transparent border-transparent text-white"
        : "public-header solid bg-white border-b border-stone-200";

  return (
    <main
      className={`public-site theme-${themeId} layout-${theme.layoutVariant}`}
      style={{
        background: theme.palette.background,
        color: theme.palette.text,
        fontFamily: theme.fontPairing.bodyFamily,
      }}
    >
      <header className={headerClass}>
        <div>
          <p className="eyebrow" style={{ color: theme.palette.accent }}>
            WMS website
          </p>
          <h1 style={{ fontFamily: theme.fontPairing.headingFamily }}>
            {tenant?.content?.navigation?.brandLabel ||
              tenant?.content?.title ||
              "Your website"}
          </h1>
        </div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.pageSlug}
              to={`/sites/${slug}/${item.pageSlug === "home" ? "" : item.pageSlug}`}
              style={{
                color:
                  theme.headerStyle === "transparent" ? "#ffffff" : undefined,
              }}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() => (isAuthenticated ? signOut() : setLoginOpen(true))}
          >
            {isAuthenticated ? "Sign out" : "Sign in"}
          </button>
        </nav>
      </header>

      <PublicPageRenderer slug={slug} pageSlug={pageSlug} />

      <div className="public-modules">
        {tenant?.enabledModules.includes("cms") && (
          <ServiceCatalogList
            onSelect={(newService) => {
              setService(newService);
              if (
                employee &&
                employee.serviceIds &&
                employee.serviceIds.length > 0 &&
                !employee.serviceIds.includes(newService.id)
              ) {
                setEmployee(null);
              }
            }}
          />
        )}
        {tenant?.enabledModules.includes("employees") && (
          <NailistsShowcase
            selectedService={service}
            selectedEmployeeId={employee?.id}
            onSelect={setEmployee}
          />
        )}
      </div>

      {service && tenant?.enabledModules.includes("agenda") && (
        <AgendaBookingWidget
          selectedService={service}
          selectedResourceId={employee?.id}
          currentUser={user}
          onRequireAuth={() => setLoginOpen(true)}
          slug={slug}
          businessId={tenant?.businessId}
          websiteId={tenant?.websiteId}
        />
      )}

      {isAuthenticated && tenant?.enabledModules.includes("customers") && (
        <CustomerProfileDrawer />
      )}

      {loginOpen && (
        <PasswordlessLoginModal onClose={() => setLoginOpen(false)} />
      )}
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/manage" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <AuthGuard>
            <Navigate to="/manage" replace />
          </AuthGuard>
        }
      />

      {/* Protected management routes */}
      <Route element={<AuthGuard />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/manage" element={<WmsWorkspaceLayout />}>
          <Route index element={<WorkspaceOverview />} />
          <Route path="websites" element={<WebsitesList />} />
          <Route path="websites/new" element={<NewWebsiteBuilder />} />
          <Route path="settings" element={<AccountSettings />} />
        </Route>
        <Route
          path="/manage/websites/:websiteId/*"
          element={<WebsiteManagementRoutes />}
        />
      </Route>

      {/* Public website viewing */}
      <Route path="/sites/:slug" element={<PublicWebsiteRoute />} />
      <Route path="/sites/:slug/*" element={<PublicWebsiteRoute />} />

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
