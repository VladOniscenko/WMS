import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { httpClient } from "../api/httpClient";
import { getTheme, type ThemeConfig, type ThemeId } from "../theme/themes";

export type Tenant = {
  businessId: string;
  websiteId: string;
  enabledModules: string[];
  themeConfig?: {
    primaryColor?: string;
    logoUrl?: string;
    font?: string;
    themeId?: ThemeId | string;
  };
  content?: {
    title?: string;
    tagline?: string;
    heroText?: string;
    heroImageUrl?: string;
    aboutText?: string;
    galleryImageUrls?: string[];
    navigation?: {
      brandLabel?: string;
      items?: { label: string; pageSlug: string }[];
      showBookingButton?: boolean;
    };
    footer?: {
      text?: string;
      address?: string;
      email?: string;
      phone?: string;
    };
  };
};

interface TenantContextValue {
  tenant: Tenant | null;
  themeId: ThemeId;
  theme: ThemeConfig;
  isLoading: boolean;
  error: string | null;
}

const defaultTheme = getTheme("editorial");

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  themeId: "editorial",
  theme: defaultTheme,
  isLoading: false,
  error: null,
});

export function useTenantResolution(slug?: string) {
  const isWorkspace =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/manage") ||
      window.location.pathname === "/admin" ||
      window.location.pathname === "/login");

  return useQuery({
    queryKey: ["tenant-resolve", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await httpClient.get<Tenant>(
        `/api/websites/resolve?slug=${encodeURIComponent(slug)}`,
      );
      return data;
    },
    enabled: !isWorkspace && Boolean(slug),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface TenantProviderProps extends PropsWithChildren {
  slug?: string;
}

export function TenantProvider({ children, slug }: TenantProviderProps) {
  const isWorkspace =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/manage") ||
      window.location.pathname === "/admin" ||
      window.location.pathname === "/login");

  // If in workspace/management, never resolve or block
  if (isWorkspace) {
    return (
      <TenantContext.Provider
        value={{
          tenant: null,
          themeId: "editorial",
          theme: defaultTheme,
          isLoading: false,
          error: null,
        }}
      >
        {children}
      </TenantContext.Provider>
    );
  }

  return <PublicTenantResolver slug={slug}>{children}</PublicTenantResolver>;
}

function PublicTenantResolver({
  children,
  slug: propSlug,
}: TenantProviderProps) {
  const pathSlug =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/sites/")
      ? window.location.pathname.split("/")[2]
      : null;
  const searchSlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("site")
      : null;
  const hostnameSlug =
    typeof window !== "undefined" ? window.location.hostname : "";

  const resolvedSlug =
    propSlug ||
    searchSlug ||
    pathSlug ||
    (hostnameSlug !== "localhost" ? hostnameSlug : "");

  const {
    data: tenant,
    isLoading,
    error: queryError,
  } = useTenantResolution(resolvedSlug);
  const errorMessage = queryError
    ? "Unable to resolve this website. Please check the address and try again."
    : null;

  const theme = getTheme(tenant?.themeConfig?.themeId);
  const themeId = theme.id;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-editorial", "theme-minimal", "theme-playful");
    root.classList.add(`theme-${themeId}`);

    const primary = tenant?.themeConfig?.primaryColor || theme.palette.primary;
    root.style.setProperty("--theme-primary", primary);
    root.style.setProperty("--theme-secondary", theme.palette.secondary);
    root.style.setProperty("--theme-bg", theme.palette.background);
    root.style.setProperty("--theme-surface", theme.palette.surface);
    root.style.setProperty("--theme-text", theme.palette.text);
    root.style.setProperty("--theme-muted", theme.palette.muted);
    root.style.setProperty("--theme-accent", theme.palette.accent);
    root.style.setProperty(
      "--theme-font-heading",
      theme.fontPairing.headingFamily,
    );
    root.style.setProperty("--theme-font-body", theme.fontPairing.bodyFamily);

    if (tenant?.themeConfig?.font) {
      root.style.setProperty("--theme-font", tenant.themeConfig.font);
    }

    if (tenant?.businessId && tenant?.websiteId) {
      try {
        localStorage.setItem(
          "studio-tenant",
          JSON.stringify({
            businessId: tenant.businessId,
            websiteId: tenant.websiteId,
          }),
        );
      } catch {
        // Ignore storage errors in restricted contexts
      }
    }

    return () => {
      root.classList.remove(`theme-${themeId}`);
    };
  }, [tenant, themeId, theme]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md p-6 bg-white rounded-2xl border border-rose-200 shadow-sm">
          <p role="alert" className="text-rose-600 font-medium">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && resolvedSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-stone-500">
        <p>Loading website…</p>
      </div>
    );
  }

  return (
    <TenantContext.Provider
      value={{
        tenant: tenant ?? null,
        themeId,
        theme,
        isLoading,
        error: errorMessage,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): Tenant | null {
  const context = useContext(TenantContext);
  return context.tenant;
}

export function useTenantContext() {
  return useContext(TenantContext);
}

export function useTenantTheme(): { themeId: ThemeId; theme: ThemeConfig } {
  const context = useContext(TenantContext);
  return { themeId: context.themeId, theme: context.theme };
}
