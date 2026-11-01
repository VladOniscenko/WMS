import { useEffect, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  UserCheck,
  Users,
  Scissors,
  Calendar,
  Layers,
  Palette,
  Boxes,
  Settings,
  ArrowRight,
  Loader2,
  X,
  type LucideProps,
} from "lucide-react";
import { httpClient } from "@shared/api/httpClient";
import { employeesApi } from "@modules/employees";
import { customersApi } from "@modules/customers";
import { cmsApi } from "@modules/cms";
import { agendaApi } from "@modules/agenda";
import type { Website } from "@shared/queries";

export interface PaletteItem {
  id: string;
  category:
    | "Pages"
    | "Employees"
    | "Customers"
    | "Services"
    | "Reservations"
    | "Navigation";
  title: string;
  subtitle?: string;
  destination: string;
  icon: ComponentType<LucideProps>;
  external?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  website?: Website;
}

export function CommandPalette({
  isOpen,
  onClose,
  website,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const websiteBase = website ? `/manage/websites/${website.id}` : "";

  // Debounce user input by 300 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state and autofocus when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global keyboard shortcuts (⌘K / Ctrl+K and Escape)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or trigger
        }
      } else if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Default navigation items when query is empty
  const defaultNavItems: PaletteItem[] = [
    ...(website
      ? [
          {
            id: "nav-pages",
            category: "Navigation" as const,
            title: "Pages",
            subtitle: "Manage canvas blocks and website content",
            destination: `${websiteBase}/pages`,
            icon: FileText,
          },
          {
            id: "nav-theme",
            category: "Navigation" as const,
            title: "Theme & navigation",
            subtitle: "Visual identity, fonts, headers, and nav links",
            destination: `${websiteBase}/theme`,
            icon: Palette,
          },
          {
            id: "nav-modules",
            category: "Navigation" as const,
            title: "Modules",
            subtitle: "Enable or disable features and integrations",
            destination: `${websiteBase}/modules`,
            icon: Boxes,
          },
          {
            id: "nav-services",
            category: "Navigation" as const,
            title: "Services",
            subtitle: "Service catalog, pricing, and duration",
            destination: `${websiteBase}/services`,
            icon: Scissors,
          },
          {
            id: "nav-customers",
            category: "Navigation" as const,
            title: "Customers",
            subtitle: "Customer directory and history",
            destination: `${websiteBase}/customers`,
            icon: Users,
          },
          {
            id: "nav-employees",
            category: "Navigation" as const,
            title: "Employees",
            subtitle: "Staff profiles, schedules, and skills",
            destination: `${websiteBase}/employees`,
            icon: UserCheck,
          },
          {
            id: "nav-agenda",
            category: "Navigation" as const,
            title: "Agenda",
            subtitle: "Appointments, reservations, and availability",
            destination: `${websiteBase}/agenda`,
            icon: Calendar,
          },
        ]
      : [
          {
            id: "nav-overview",
            category: "Navigation" as const,
            title: "Overview",
            subtitle: "Workspace summary and metrics",
            destination: "/manage",
            icon: Layers,
          },
          {
            id: "nav-websites",
            category: "Navigation" as const,
            title: "All websites",
            subtitle: "View and manage your websites",
            destination: "/manage/websites",
            icon: FileText,
          },
          {
            id: "nav-settings",
            category: "Navigation" as const,
            title: "Account settings",
            subtitle: "Profile and security configuration",
            destination: "/manage/settings",
            icon: Settings,
          },
        ]),
  ];

  // Multi-entity search across 5 domains when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery) {
      setItems(defaultNavItems);
      setSelectedIndex(0);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);

    const lower = debouncedQuery.toLowerCase();

    // 1. Pages Search
    const pagesPromise = (async () => {
      if (!website?.id) return [];
      try {
        const { data } = await httpClient.get<
          Array<{ id: string; title: string; slug: string; status: string }>
        >(`/api/websites/${website.id}/pages`);
        return data
          .filter(
            (p) =>
              p.title.toLowerCase().includes(lower) ||
              p.slug.toLowerCase().includes(lower),
          )
          .map<PaletteItem>((p) => ({
            id: `page-${p.id}`,
            category: "Pages",
            title: p.title,
            subtitle: `/${p.slug} · Status: ${p.status}`,
            destination: `${websiteBase}/pages`,
            icon: FileText,
          }));
      } catch {
        return [];
      }
    })();

    // 2. Employees Search
    const employeesPromise = (async () => {
      try {
        const { data } = await employeesApi.list();
        return data
          .filter(
            (e) =>
              (e.displayName && e.displayName.toLowerCase().includes(lower)) ||
              (e.email && e.email.toLowerCase().includes(lower)) ||
              (e.roleTitle && e.roleTitle.toLowerCase().includes(lower)),
          )
          .map<PaletteItem>((e) => ({
            id: `emp-${e.id}`,
            category: "Employees",
            title: e.displayName,
            subtitle: `${e.roleTitle} · ${e.email}`,
            destination: websiteBase
              ? `${websiteBase}/employees`
              : "/manage/websites",
            icon: UserCheck,
          }));
      } catch {
        return [];
      }
    })();

    // 3. Customers Search
    const customersPromise = (async () => {
      try {
        const { data } = await customersApi.list(debouncedQuery);
        return (data.items || [])
          .filter(
            (c) =>
              (c.firstName && c.firstName.toLowerCase().includes(lower)) ||
              (c.lastName && c.lastName.toLowerCase().includes(lower)) ||
              c.email.toLowerCase().includes(lower) ||
              (c.phone && c.phone.includes(lower)),
          )
          .map<PaletteItem>((c) => {
            const name =
              [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
            return {
              id: `cust-${c.id}`,
              category: "Customers",
              title: name,
              subtitle: `${c.email}${c.phone ? ` · ${c.phone}` : ""}`,
              destination: websiteBase
                ? `${websiteBase}/customers`
                : "/manage/websites",
              icon: Users,
            };
          });
      } catch {
        return [];
      }
    })();

    // 4. Services Search
    const servicesPromise = (async () => {
      try {
        const { data } = await cmsApi.services();
        return data
          .filter(
            (s) =>
              s.name.toLowerCase().includes(lower) ||
              (s.description && s.description.toLowerCase().includes(lower)) ||
              (s.category && s.category.toLowerCase().includes(lower)),
          )
          .map<PaletteItem>((s) => ({
            id: `srv-${s.id}`,
            category: "Services",
            title: s.name,
            subtitle: `${s.durationMinutes} min · ${s.price} ${s.currency} · ${s.category || "General"}`,
            destination: websiteBase
              ? `${websiteBase}/services`
              : "/manage/websites",
            icon: Scissors,
          }));
      } catch {
        return [];
      }
    })();

    // 5. Reservations Search
    const reservationsPromise = (async () => {
      try {
        const { data } = await agendaApi.list({});
        return data
          .filter(
            (r) =>
              (r.serviceSnapshot?.serviceName &&
                r.serviceSnapshot.serviceName.toLowerCase().includes(lower)) ||
              (r.clientSnapshot?.name &&
                r.clientSnapshot.name.toLowerCase().includes(lower)) ||
              r.status.toLowerCase().includes(lower),
          )
          .map<PaletteItem>((r) => {
            const serviceName = r.serviceSnapshot?.serviceName || "Reservation";
            const client = r.clientSnapshot?.name
              ? `Client: ${r.clientSnapshot.name} · `
              : "";
            const dateStr = new Date(r.startAtUtc).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              },
            );
            return {
              id: `res-${r.id}`,
              category: "Reservations",
              title: serviceName,
              subtitle: `${client}${r.status} (${dateStr})`,
              destination: websiteBase
                ? `${websiteBase}/agenda`
                : "/manage/websites",
              icon: Calendar,
            };
          });
      } catch {
        return [];
      }
    })();

    // Navigation matches
    const matchingNav = defaultNavItems.filter(
      (n) =>
        n.title.toLowerCase().includes(lower) ||
        (n.subtitle && n.subtitle.toLowerCase().includes(lower)),
    );

    Promise.allSettled([
      pagesPromise,
      employeesPromise,
      customersPromise,
      servicesPromise,
      reservationsPromise,
    ]).then((results) => {
      if (!isSubscribed) return;

      const collected: PaletteItem[] = [];

      if (matchingNav.length) {
        collected.push(...matchingNav);
      }

      results.forEach((res) => {
        if (res.status === "fulfilled") {
          collected.push(...res.value);
        }
      });

      setItems(collected);
      setSelectedIndex(0);
      setIsLoading(false);
    });

    return () => {
      isSubscribed = false;
    };
  }, [debouncedQuery, websiteBase, website?.id]);

  // Keyboard navigation inside dialog (Up, Down, Enter)
  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = items[selectedIndex];
      if (selected) {
        navigate(selected.destination);
        onClose();
      }
    }
  }

  // Ensure selected item is scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-palette-index="${selectedIndex}"]`,
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group items by category for clean visual hierarchy
  const categories: Array<PaletteItem["category"]> = [
    "Navigation",
    "Pages",
    "Services",
    "Employees",
    "Customers",
    "Reservations",
  ];

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-200 bg-stone-50/50">
          <Search className="w-5 h-5 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-stone-800 placeholder:text-stone-400 text-base focus:outline-none"
            placeholder={
              website
                ? `Search in ${website.name} (pages, team, clients, agenda…)`
                : "Search workspace…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-stone-400 animate-spin shrink-0" />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-200/50"
              aria-label="Clear query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block text-[10px] font-medium text-stone-400 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded shadow-2xs font-mono">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="overflow-y-auto flex-1 p-2 space-y-3"
          role="listbox"
        >
          {items.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <p className="text-sm">No results found for “{debouncedQuery}”</p>
              <p className="text-xs text-stone-400 mt-1">
                Try searching for pages, services, employees, or customers.
              </p>
            </div>
          ) : (
            categories.map((category) => {
              const categoryItems = items.filter(
                (item) => item.category === category,
              );
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
                    {category}
                  </div>
                  {categoryItems.map((item) => {
                    const itemIndex = runningIndex++;
                    const isSelected = itemIndex === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        data-palette-index={itemIndex}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#f4ebe6] text-stone-900 shadow-2xs"
                            : "text-stone-700 hover:bg-stone-100"
                        }`}
                        onClick={() => {
                          navigate(item.destination);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isSelected
                                ? "bg-[#e0a68d] text-white"
                                : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-medium leading-snug truncate">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-xs text-stone-500 truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 text-xs text-[#b26c59] font-medium shrink-0">
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono text-[10px]">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono text-[10px]">
                ↵
              </kbd>{" "}
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono text-[10px]">
              esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Topbar Search trigger button with global ⌘K keyboard listener
 */
export function WorkspaceSearch({ website }: { website?: Website }) {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for ⌘K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 hover:text-stone-800 text-xs font-medium transition-all shadow-2xs hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#e0a68d]"
        onClick={() => setIsOpen(true)}
        aria-label="Search workspace (Press ⌘K)"
      >
        <Search className="w-3.5 h-3.5 text-stone-400" />
        <span className="hidden sm:inline">Search workspace…</span>
        <span className="inline sm:hidden">Search</span>
        <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-stone-100 border border-stone-200 rounded text-stone-400 font-mono">
          ⌘K
        </kbd>
      </button>

      <CommandPalette
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        website={website}
      />
    </>
  );
}
