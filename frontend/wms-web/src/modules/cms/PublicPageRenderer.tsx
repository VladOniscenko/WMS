import { useCallback, useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { AlertTriangle, Clock, Home, RefreshCw, Sparkles } from "lucide-react";
import { httpClient } from "@shared/api/httpClient";
import { useTenantTheme } from "@shared/tenancy/TenantProvider";
import { getTheme, type ThemeConfig } from "@shared/theme/themes";

type Section = {
  id: string;
  type: string;
  heading: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  backgroundImageUrl?: string;
  galleryImages?: string[];
  sortOrder?: number;
};

type Page = {
  title: string;
  status?: string;
  sections: Section[];
};

type WebsiteContent = {
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

type ResolvedPayload = {
  page?: Page | null;
  content?: WebsiteContent;
  isDraft?: boolean;
  websiteStatus?: string;
  pageStatus?: string;
};

interface PublicPageRendererProps {
  slug: string;
  pageSlug?: string;
  themeOverride?: ThemeConfig;
}

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "draft" }
  | { kind: "error"; message?: string }
  | { kind: "success"; payload: ResolvedPayload & { page: Page } };

export function PublicPageRenderer({
  slug,
  pageSlug = "home",
  themeOverride,
}: PublicPageRendererProps) {
  const { theme: contextTheme } = useTenantTheme();
  const theme = themeOverride || contextTheme || getTheme("editorial");
  const [state, setState] = useState<PageState>({ kind: "loading" });

  const fetchPage = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await httpClient.get<ResolvedPayload>(
        `/api/websites/resolve/${encodeURIComponent(slug)}/${encodeURIComponent(pageSlug)}`,
      );

      const data = response.data;

      // Check if website or page is in Draft status
      if (
        data.isDraft ||
        data.websiteStatus === "Draft" ||
        data.pageStatus === "Draft" ||
        data.page?.status === "Draft"
      ) {
        setState({ kind: "draft" });
        return;
      }

      if (!data.page) {
        setState({ kind: "not_found" });
        return;
      }

      setState({
        kind: "success",
        payload: { ...data, page: data.page },
      });
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };
      if (error.response?.status === 404) {
        setState({ kind: "not_found" });
      } else {
        setState({
          kind: "error",
          message: "A network error occurred while connecting to the server.",
        });
      }
    }
  }, [slug, pageSlug]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  // 1. Loading state
  if (state.kind === "loading") {
    return (
      <div className="py-24 text-center">
        <div className="inline-flex items-center gap-2 text-stone-500 font-medium animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin text-[#b26c59]" />
          <span>Loading page…</span>
        </div>
      </div>
    );
  }

  // 2. 404 Not Found state
  if (state.kind === "not_found") {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl border border-stone-200 shadow-sm">
          <span className="text-4xl font-serif text-[#b26c59] block mb-2">404</span>
          <h2 className="text-2xl font-serif font-semibold text-stone-900 mb-2">
            This website is not available
          </h2>
          <p className="text-sm text-stone-500 mb-6 leading-relaxed">
            The page you requested could not be located. It may have been unpublished, moved, or deleted.
          </p>
          <a
            href={slug ? `/sites/${slug}` : "/"}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#b26c59] hover:bg-[#9c5947] transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to homepage
          </a>
        </div>
      </div>
    );
  }

  // 3. Draft / Coming Soon placeholder
  if (state.kind === "draft") {
    return (
      <div className="min-h-[55vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-lg w-full p-10 bg-white rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-[#b26c59]/10 text-[#b26c59] flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8" />
          </div>
          <span className="text-xs uppercase tracking-widest text-[#b26c59] font-semibold">
            Under Construction
          </span>
          <h2 className="text-3xl font-serif font-semibold text-stone-900 mt-1 mb-3">
            Coming Soon
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed max-w-md mx-auto mb-6">
            Our studio website is currently being crafted with love. Please check back soon or follow our social channels for updates and announcements!
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            Expected to launch soon
          </div>
        </div>
      </div>
    );
  }

  // 4. Network error state with retry option
  if (state.kind === "error") {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl border border-rose-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-stone-900 mb-2">
            Unable to load page
          </h2>
          <p className="text-sm text-stone-500 mb-6 leading-relaxed">
            {state.message || "A network or server error occurred. Please check your connection and retry."}
          </p>
          <button
            type="button"
            onClick={() => void fetchPage()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { payload } = state;
  const { heroLayout, cardStyle, layoutVariant } = theme;

  const cardStyleClass =
    cardStyle === "rounded"
      ? "rounded-2xl shadow-sm border border-stone-200/80 bg-white"
      : cardStyle === "bordered"
        ? "rounded-none border-2 border-stone-800 bg-white shadow-none"
        : "rounded-xl border-0 bg-stone-100/80 shadow-none";

  return (
    <div className={`theme-${theme.id} layout-${layoutVariant}`}>
      {payload.page.sections.map((section) => {
        const isHero = section.type === "hero";

        if (isHero) {
          const bgStyle = section.backgroundImageUrl
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${section.backgroundImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined;

          if (heroLayout === "full-bleed") {
            return (
              <section
                key={section.id}
                className="public-section public-hero full-bleed relative overflow-hidden py-20 px-6 text-white"
                style={{
                  ...bgStyle,
                  fontFamily: theme.fontPairing.bodyFamily,
                }}
              >
                <div className="relative z-10 max-w-4xl mx-auto">
                  <p className="public-kicker font-medium tracking-widest text-xs uppercase mb-2 text-stone-200">
                    Welcome
                  </p>
                  <h2
                    className="text-4xl md:text-6xl font-serif font-semibold tracking-tight text-white mb-4"
                    style={{ fontFamily: theme.fontPairing.headingFamily }}
                  >
                    {section.heading}
                  </h2>
                  {section.body && (
                    <div
                      className="text-lg md:text-xl text-stone-100 max-w-2xl leading-relaxed mb-6"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(section.body),
                      }}
                    />
                  )}
                  {section.ctaLabel && (
                    <a
                      href={section.ctaUrl || "#booking"}
                      className="inline-block px-6 py-3 rounded-xl font-medium text-white bg-[#b26c59] hover:bg-[#9c5947] transition-all shadow-md"
                    >
                      {section.ctaLabel}
                    </a>
                  )}
                  {section.imageUrl && (
                    <div className="mt-8 rounded-xl overflow-hidden shadow-2xl max-h-96">
                      <img
                        src={section.imageUrl}
                        alt={section.heading}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          }

          // Centered hero layout
          return (
            <section
              key={section.id}
              className="public-section public-hero centered py-16 md:py-24 px-6 max-w-5xl mx-auto text-center"
              style={{
                ...bgStyle,
                fontFamily: theme.fontPairing.bodyFamily,
              }}
            >
              <div className="max-w-3xl mx-auto">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 bg-stone-200 text-stone-700">
                  Featured
                </span>
                <h2
                  className="text-3xl md:text-5xl font-bold tracking-tight mb-6"
                  style={{ fontFamily: theme.fontPairing.headingFamily }}
                >
                  {section.heading}
                </h2>
                {section.body && (
                  <div
                    className="text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed mb-8 prose"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(section.body),
                    }}
                  />
                )}
                {section.ctaLabel && (
                  <div className="mb-8">
                    <a
                      href={section.ctaUrl || "#booking"}
                      className="inline-block px-6 py-3 rounded-xl font-medium text-white bg-[#b26c59] hover:bg-[#9c5947] transition-all shadow-md"
                    >
                      {section.ctaLabel}
                    </a>
                  </div>
                )}
                {section.imageUrl && (
                  <div
                    className={`mt-6 overflow-hidden mx-auto ${
                      cardStyle === "rounded"
                        ? "rounded-3xl shadow-lg"
                        : cardStyle === "bordered"
                          ? "rounded-none border-2 border-stone-800"
                          : "rounded-xl"
                    }`}
                  >
                    <img
                      src={section.imageUrl}
                      alt={section.heading}
                      className="w-full max-h-[460px] object-cover"
                    />
                  </div>
                )}
              </div>
            </section>
          );
        }

        // Standard sections (text, gallery, etc.)
        return (
          <section
            key={section.id}
            className={`public-section my-8 p-6 md:p-10 ${cardStyleClass}`}
            style={{ fontFamily: theme.fontPairing.bodyFamily }}
          >
            <div
              className={
                layoutVariant === "split"
                  ? "grid md:grid-cols-2 gap-8 items-center"
                  : ""
              }
            >
              <div>
                <h2
                  className="text-2xl md:text-3xl font-semibold mb-4 text-stone-900"
                  style={{ fontFamily: theme.fontPairing.headingFamily }}
                >
                  {section.heading}
                </h2>
                {section.body && (
                  <div
                    className="text-stone-600 leading-relaxed rich-text-body space-y-2"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(section.body),
                    }}
                  />
                )}
              </div>
              {section.imageUrl && (
                <div
                  className={`mt-4 md:mt-0 overflow-hidden ${
                    cardStyle === "rounded"
                      ? "rounded-xl"
                      : cardStyle === "bordered"
                        ? "border border-stone-300"
                        : "rounded-lg"
                  }`}
                >
                  <img
                    src={section.imageUrl}
                    alt={section.heading}
                    className="w-full h-auto max-h-80 object-cover"
                  />
                </div>
              )}
            </div>
          </section>
        );
      })}

      <footer className="public-footer">
        <strong>{payload.content?.footer?.text}</strong>
        {payload.content?.footer?.address && (
          <span>{payload.content.footer.address}</span>
        )}
        {payload.content?.footer?.email && (
          <span>{payload.content.footer.email}</span>
        )}
        {payload.content?.footer?.phone && (
          <span>{payload.content.footer.phone}</span>
        )}
      </footer>
    </div>
  );
}
