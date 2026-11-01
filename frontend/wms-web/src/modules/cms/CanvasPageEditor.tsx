import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import DOMPurify from "dompurify";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Sparkles,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  Eye,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Tablet,
  Upload,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  RemoveFormatting,
  Calendar,
  MapPin,
  Star,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { httpClient } from "@shared/api/httpClient";
import { ConfirmDialog } from "@shared/ui/ConfirmDialog";
import { useToast } from "@shared/ui/Toast";
import { getTheme } from "@shared/theme/themes";

export type CanvasSection = {
  id: string;
  type: string;
  heading: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  backgroundImageUrl?: string;
  galleryImages?: string[];
  sortOrder: number;
};

type Page = {
  id: string;
  websiteId: string;
  title: string;
  slug: string;
  status: string;
  showInNavigation?: boolean;
  sections: CanvasSection[];
};

type WebsiteInfo = {
  id: string;
  name: string;
  domainOrSlug?: string;
  themeConfig?: {
    primaryColor?: string;
    logoUrl?: string;
    font?: string;
    themeId?: string;
  };
  content?: {
    title?: string;
    tagline?: string;
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

const blockTypes = [
  ["hero", "Hero", "Large introduction with a call to action"],
  ["text", "Rich text", "Heading and formatted story content"],
  ["image", "Image", "A full-width visual block"],
  ["gallery", "Gallery", "A grid of brand imagery"],
  ["services", "Services", "Your service catalogue"],
  ["employees", "Nailists", "Meet your team"],
  ["booking", "Booking", "Let customers reserve a time"],
  ["testimonials", "Testimonials", "Social proof from customers"],
  ["contact", "Contact", "Address, opening hours, and contact"],
  ["custom_html", "Custom HTML", "Advanced custom content"],
];

type DeviceMode = "desktop" | "tablet" | "mobile";

export function CanvasPageEditor({
  websiteId,
  websiteName,
  website: propWebsite,
  onBack,
}: {
  websiteId: string;
  websiteName: string;
  website?: WebsiteInfo;
  onBack: () => void;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [activeId, setActiveId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [website, setWebsite] = useState<WebsiteInfo | null>(propWebsite || null);

  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Device switcher state
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");

  // Full Preview modal
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);

  // Navigation guard dialog
  const [navGuardOpen, setNavGuardOpen] = useState(false);

  // Page management modals
  const [pageTitle, setPageTitle] = useState("");
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPage, setNewPage] = useState({ title: "", slug: "" });
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Page | null>(null);

  // Image upload state in inspector
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadDropActive, setUploadDropActive] = useState(false);

  const toast = useToast();

  const active = pages.find((page) => page.id === activeId);
  const selected = active?.sections.find((section) => section.id === selectedId);

  // Load website info if not provided
  useEffect(() => {
    if (!website) {
      httpClient
        .get<WebsiteInfo>(`/api/websites/${websiteId}`)
        .then(({ data }) => setWebsite(data))
        .catch(() => {
          /* Fallback */
        });
    }
  }, [websiteId, website]);

  // Load pages
  const loadPages = useCallback(async () => {
    try {
      const response = await httpClient.get<Page[]>(`/api/websites/${websiteId}/pages`);
      setPages(response.data);
      if (response.data[0]) {
        setActiveId((current) => current || response.data[0].id);
        setPageTitle(response.data[0].title);
      }
    } catch {
      toast.error("Failed to load website pages.");
    }
  }, [websiteId, toast]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  // Save function called by auto-save or manual button
  const performSave = useCallback(
    async (pageToSave: Page) => {
      setSaveStatus("saving");
      try {
        const response = await httpClient.put<Page>(
          `/api/websites/${websiteId}/pages/${pageToSave.id}`,
          pageToSave,
        );
        setPages((current) =>
          current.map((p) => (p.id === pageToSave.id ? response.data : p)),
        );
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
      } catch {
        setSaveStatus("unsaved");
        toast.error("Failed to auto-save page changes.");
      }
    },
    [websiteId, toast],
  );

  // Trigger auto-save debounce on changes (1500 ms)
  const triggerAutoSave = useCallback(
    (nextPage: Page) => {
      setSaveStatus("unsaved");
      setHasUnsavedChanges(true);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        void performSave(nextPage);
      }, 1500);
    },
    [performSave],
  );

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // WMS-014: Browser beforeunload event warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle in-app navigation guard
  function handleBackClick() {
    if (hasUnsavedChanges) {
      setNavGuardOpen(true);
    } else {
      onBack();
    }
  }

  // Section updating helper that auto-saves
  function updateSection(patch: Partial<CanvasSection>) {
    if (!active || !selected) return;
    const next = {
      ...active,
      sections: active.sections.map((section) =>
        section.id === selected.id ? { ...section, ...patch } : section,
      ),
    };
    setPages((current) =>
      current.map((page) => (page.id === next.id ? next : page)),
    );
    triggerAutoSave(next);
  }

  function addBlock(type: string) {
    if (!active) return;
    const next: CanvasSection = {
      id: crypto.randomUUID(),
      type,
      heading: blockTypes.find((item) => item[0] === type)?.[1] ?? "New section",
      body: "Welcome to our studio. We provide premium nail styling, manicures, and bespoke nail art tailored to your elegance.",
      sortOrder: active.sections.length,
      ctaLabel: type === "hero" ? "Book an Appointment" : undefined,
      ctaUrl: type === "hero" ? "#booking" : undefined,
    };
    const page = { ...active, sections: [...active.sections, next] };
    setPages((current) =>
      current.map((item) => (item.id === page.id ? page : item)),
    );
    setSelectedId(next.id);
    triggerAutoSave(page);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (!active) return;
    const target = index + direction;
    if (target < 0 || target >= active.sections.length) return;
    const sections = [...active.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    const page = {
      ...active,
      sections: sections.map((item, position) => ({
        ...item,
        sortOrder: position,
      })),
    };
    setPages((current) =>
      current.map((item) => (item.id === page.id ? page : item)),
    );
    triggerAutoSave(page);
  }

  function duplicateBlock(section: CanvasSection) {
    if (!active) return;
    const copy = {
      ...section,
      id: crypto.randomUUID(),
      heading: `${section.heading} (Copy)`,
      sortOrder: active.sections.length,
    };
    const page = { ...active, sections: [...active.sections, copy] };
    setPages((current) =>
      current.map((p) => (p.id === active.id ? page : p)),
    );
    setSelectedId(copy.id);
    triggerAutoSave(page);
  }

  function deleteBlock(sectionId: string) {
    if (!active) return;
    const page = {
      ...active,
      sections: active.sections.filter((s) => s.id !== sectionId),
    };
    setPages((current) =>
      current.map((p) => (p.id === active.id ? page : p)),
    );
    if (selectedId === sectionId) {
      setSelectedId("");
    }
    triggerAutoSave(page);
  }

  // Upload file helper via /api/assets
  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    setUploadingImage(true);
    try {
      const response = await httpClient.post<{ url: string }>("/api/assets", form);
      toast.success("Image uploaded successfully.");
      return response.data.url;
    } catch {
      toast.error("Failed to upload image.");
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    const url = await uploadFile(file);
    if (url) {
      updateSection({ imageUrl: url });
    }
  }

  async function handleDropImage(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setUploadDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !selected) return;
    const url = await uploadFile(file);
    if (url) {
      if (selected.type === "gallery") {
        const existing = selected.galleryImages || [];
        updateSection({ galleryImages: [...existing, url] });
      } else {
        updateSection({ imageUrl: url });
      }
    }
  }

  // Rich Text Editor formatting tools for block body (WMS-015)
  function applyRichFormatting(format: "bold" | "italic" | "bullet" | "number" | "link" | "clear") {
    if (!selected) return;
    const current = selected.body || "";

    switch (format) {
      case "bold":
        updateSection({ body: current ? `<strong>${current}</strong>` : "<strong>Bold text</strong>" });
        break;
      case "italic":
        updateSection({ body: current ? `<em>${current}</em>` : "<em>Italic text</em>" });
        break;
      case "bullet":
        updateSection({
          body: current ? `<ul><li>${current}</li></ul>` : "<ul><li>First item</li><li>Second item</li></ul>",
        });
        break;
      case "number":
        updateSection({
          body: current ? `<ol><li>${current}</li></ol>` : "<ol><li>First step</li><li>Second step</li></ol>",
        });
        break;
      case "link": {
        const url = window.prompt("Enter link URL (e.g. https://... or #booking):", "https://");
        if (url) {
          updateSection({
            body: current
              ? `${current} <a href="${url}" target="_blank" rel="noopener noreferrer">Learn more</a>`
              : `<a href="${url}" target="_blank" rel="noopener noreferrer">Learn more</a>`,
          });
        }
        break;
      }
      case "clear":
        // Strip HTML tags
        updateSection({ body: current.replace(/<[^>]*>/g, "") });
        break;
    }
  }

  // Page creation
  async function createPage() {
    const title = newPage.title.trim();
    const slug = newPage.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!title || !slug) return;
    try {
      const response = await httpClient.post<Page>(
        `/api/websites/${websiteId}/pages`,
        {
          title,
          slug,
          status: "Draft",
          showInNavigation: true,
          sections: [],
        },
      );
      setPages((current) => [...current, response.data]);
      setActiveId(response.data.id);
      setPageTitle(response.data.title);
      setNewPage({ title: "", slug: "" });
      setNewPageOpen(false);
      toast.success(`Page "${title}" created.`);
    } catch {
      toast.error("Failed to create page.");
    }
  }

  async function confirmDeletePage() {
    if (!deleteConfirmTarget) return;
    const target = deleteConfirmTarget;
    try {
      await httpClient.delete(`/api/websites/${websiteId}/pages/${target.id}`);
      setPages((current) => current.filter((item) => item.id !== target.id));
      setActiveId((current) => (current === target.id ? "" : current));
      toast.success(`Page "${target.title}" deleted.`);
    } catch {
      toast.error("Failed to delete page.");
    } finally {
      setDeleteConfirmTarget(null);
    }
  }

  // Device width styles (WMS-016)
  const deviceContainerWidth =
    deviceMode === "mobile"
      ? "375px"
      : deviceMode === "tablet"
        ? "768px"
        : "100%";

  const themeConfig = getTheme(website?.themeConfig?.themeId as any);

  if (!active) {
    return (
      <section className="editor-empty min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-stone-50 rounded-3xl border border-stone-200 m-6">
        <Sparkles className="w-12 h-12 text-[#b26c59] mb-3" />
        <h2 className="text-2xl font-serif font-semibold text-stone-900 mb-2">
          Start your first page
        </h2>
        <p className="text-sm text-stone-500 max-w-md mb-6">
          Every website begins with a page. Add one, then build it visually with customizable sections.
        </p>
        <button
          className="button primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#b26c59] hover:bg-[#9c5947] cursor-pointer shadow-sm"
          onClick={async () => {
            try {
              const response = await httpClient.post<Page>(
                `/api/websites/${websiteId}/pages`,
                {
                  title: "Home",
                  slug: "home",
                  status: "Draft",
                  showInNavigation: true,
                  sections: [],
                },
              );
              setPages([response.data]);
              setActiveId(response.data.id);
              setPageTitle(response.data.title);
              toast.success("Home page created.");
            } catch {
              toast.error("Could not create home page.");
            }
          }}
        >
          <Plus className="w-4 h-4" />
          Create home page
        </button>
      </section>
    );
  }

  return (
    <section className="canvas-editor flex flex-col h-screen overflow-hidden bg-stone-100">
      {/* TOP TOOLBAR */}
      <header className="editor-toolbar h-14 bg-white border-b border-stone-200 px-4 flex items-center justify-between gap-4 shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            onClick={handleBackClick}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Websites</span>
          </button>
          <span className="h-4 w-px bg-stone-200" />
          <div>
            <span className="text-[10px] uppercase font-semibold text-stone-400 block leading-tight">
              {websiteName}
            </span>
            <strong className="text-xs font-semibold text-stone-900 block leading-tight">
              {pageTitle || active.title}
            </strong>
          </div>
        </div>

        {/* DEVICE SWITCHER (WMS-016) */}
        <div className="hidden md:flex items-center rounded-xl p-1 bg-stone-100 border border-stone-200 text-xs">
          <button
            type="button"
            aria-label="Desktop preview"
            onClick={() => setDeviceMode("desktop")}
            className={`px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
              deviceMode === "desktop"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            aria-label="Tablet preview"
            onClick={() => setDeviceMode("tablet")}
            className={`px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
              deviceMode === "tablet"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Tablet</span>
          </button>
          <button
            type="button"
            aria-label="Mobile preview"
            onClick={() => setDeviceMode("mobile")}
            className={`px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
              deviceMode === "mobile"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
        </div>

        {/* AUTO-SAVE STATUS INDICATOR (WMS-014) */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium flex items-center gap-1.5">
            {saveStatus === "saving" ? (
              <span className="inline-flex items-center gap-1.5 text-stone-500">
                <RefreshCw className="w-3 h-3 animate-spin text-[#b26c59]" />
                Saving…
              </span>
            ) : saveStatus === "unsaved" ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                All changes saved
              </span>
            )}
          </div>

          <span className="h-4 w-px bg-stone-200" />

          {/* FULL PREVIEW MODAL BUTTON (WMS-016) */}
          <button
            type="button"
            onClick={() => setFullPreviewOpen(true)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Full Preview</span>
          </button>

          {/* PAGE ACTIONS */}
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center gap-1 cursor-pointer"
            onClick={() => setNewPageOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New page</span>
          </button>

          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            onClick={() => void performSave(active)}
          >
            Save draft
          </button>

          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
              active.status === "Published"
                ? "bg-stone-100 text-stone-700 hover:bg-stone-200"
                : "bg-[#b26c59] text-white hover:bg-[#9c5947]"
            }`}
            onClick={() =>
              void performSave({
                ...active,
                status: active.status === "Published" ? "Draft" : "Published",
              })
            }
          >
            {active.status === "Published" ? "Unpublish" : "Publish page"}
          </button>
        </div>
      </header>

      {/* NEW PAGE INLINE FORM */}
      {newPageOpen && (
        <div className="bg-white border-b border-stone-200 p-4 flex items-center gap-3 z-20">
          <input
            autoFocus
            placeholder="Page title (e.g. About Us)"
            value={newPage.title}
            onChange={(event) =>
              setNewPage({ ...newPage, title: event.target.value })
            }
            className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium focus:ring-2 focus:ring-[#b26c59]"
          />
          <input
            placeholder="URL slug (e.g. about)"
            value={newPage.slug}
            onChange={(event) =>
              setNewPage({ ...newPage, slug: event.target.value })
            }
            className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium focus:ring-2 focus:ring-[#b26c59]"
          />
          <button
            type="button"
            className="px-3 py-1.5 bg-[#b26c59] text-white rounded-xl text-xs font-medium hover:bg-[#9c5947] cursor-pointer"
            onClick={() => void createPage()}
          >
            Create page
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
            onClick={() => setNewPageOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* MAIN 3-PANE WORKSPACE: [Pages & Blocks Library] | [Real Canvas] | [Block Inspector] */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT ASIDE: Pages & Add Section Library */}
        <aside className="w-64 bg-white border-r border-stone-200 flex flex-col shrink-0 overflow-y-auto p-4 space-y-6">
          {/* Pages list */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-2">
              Website Pages
            </span>
            <div className="space-y-1">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-colors ${
                    page.id === active.id
                      ? "bg-[#b26c59]/10 text-[#b26c59] font-semibold"
                      : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left truncate cursor-pointer"
                    onClick={() => {
                      setActiveId(page.id);
                      setPageTitle(page.title);
                      setSelectedId("");
                    }}
                  >
                    <span>{page.title}</span>
                    <span className="block text-[10px] font-mono text-stone-400">
                      /{page.slug}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${page.title}`}
                    className="p-1 text-stone-300 hover:text-rose-600 transition-colors cursor-pointer"
                    onClick={() => setDeleteConfirmTarget(page)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add block to page */}
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block mb-2">
              Add Section Block
            </span>
            <div className="space-y-1.5">
              {blockTypes.map(([type, label, description]) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => addBlock(type)}
                  className="w-full p-2.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50/70 text-left transition-all cursor-pointer flex items-start gap-2.5 group"
                >
                  <span className="p-1.5 rounded-lg bg-stone-100 text-stone-600 group-hover:bg-[#b26c59]/10 group-hover:text-[#b26c59] transition-colors shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                  <div className="overflow-hidden">
                    <strong className="block text-xs text-stone-800 font-medium truncate">
                      {label}
                    </strong>
                    <span className="block text-[10px] text-stone-400 truncate">
                      {description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER PANE: REAL WYSIWYG CANVAS PREVIEW (WMS-016) */}
        <main className="flex-1 bg-stone-200/60 p-6 overflow-y-auto flex flex-col items-center">
          <div
            className="canvas-device-container transition-all duration-300 bg-white rounded-3xl shadow-xl border border-stone-200/80 overflow-hidden flex flex-col min-h-[700px]"
            style={{ width: deviceContainerWidth, maxWidth: "100%" }}
          >
            {/* REAL THEME NAVIGATION BAR (WMS-016) */}
            <div className="canvas-site-header px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <div>
                <strong
                  className="text-base font-serif font-semibold text-stone-900"
                  style={{ fontFamily: themeConfig.fontPairing.headingFamily }}
                >
                  {website?.content?.navigation?.brandLabel ||
                    website?.content?.title ||
                    websiteName}
                </strong>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
                {pages.slice(0, 4).map((p) => (
                  <span
                    key={p.id}
                    className={p.id === active.id ? "text-[#b26c59] font-bold" : ""}
                  >
                    {p.title}
                  </span>
                ))}
                {website?.content?.navigation?.showBookingButton !== false && (
                  <span className="px-3 py-1 rounded-full bg-[#b26c59] text-white text-[11px] font-medium shadow-xs">
                    Book Now
                  </span>
                )}
              </div>
            </div>

            {/* EMPTY CANVAS PLACEHOLDER */}
            {active.sections.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-stone-400">
                <Sparkles className="w-12 h-12 text-[#b26c59] mb-3" />
                <h3 className="text-xl font-serif font-semibold text-stone-800 mb-1">
                  Your page canvas is empty
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mb-4">
                  Select block sections from the left sidebar to add them to your page layout.
                </p>
                <button
                  type="button"
                  onClick={() => addBlock("hero")}
                  className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 cursor-pointer"
                >
                  Add Hero Section
                </button>
              </div>
            )}

            {/* SECTIONS LIST WITH REAL VISUAL RENDERING (WMS-016) */}
            <div className="flex-1 p-4 space-y-4">
              {active.sections.map((section, index) => {
                const isSelected = selectedId === section.id;

                return (
                  <article
                    key={section.id}
                    onClick={() => setSelectedId(section.id)}
                    className={`canvas-section-block relative rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                      isSelected
                        ? "border-[#b26c59] ring-2 ring-[#b26c59]/20 shadow-md bg-white"
                        : "border-stone-200 bg-white hover:border-stone-300 shadow-xs"
                    }`}
                  >
                    {/* Top Action Bar when Selected */}
                    {isSelected && (
                      <div className="bg-[#b26c59] text-white px-3 py-1 text-xs font-semibold flex items-center justify-between">
                        <span className="uppercase tracking-wider text-[10px]">
                          {section.type.replace("_", " ")} Block
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Move block up"
                            disabled={index === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveBlock(index, -1);
                            }}
                            className="p-1 hover:bg-white/20 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move block down"
                            disabled={index === active.sections.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveBlock(index, 1);
                            }}
                            className="p-1 hover:bg-white/20 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Duplicate block"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateBlock(section);
                            }}
                            className="p-1 hover:bg-white/20 rounded cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete block"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBlock(section.id);
                            }}
                            className="p-1 hover:bg-rose-500 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SECTION VISUAL RENDERER (WMS-016) */}
                    <div className="p-6">
                      {/* 1. HERO BLOCK */}
                      {section.type === "hero" && (
                        <div
                          className="rounded-2xl p-8 text-center text-white relative overflow-hidden"
                          style={{
                            background: section.backgroundImageUrl
                              ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url(${section.backgroundImageUrl}) center/cover`
                              : "linear-gradient(135deg,#3b2931,#b06a59)",
                          }}
                        >
                          <span className="text-[11px] uppercase tracking-widest text-amber-200 font-semibold mb-2 block">
                            Featured
                          </span>
                          <h2
                            className="text-2xl md:text-4xl font-serif font-bold mb-3"
                            style={{ fontFamily: themeConfig.fontPairing.headingFamily }}
                          >
                            {section.heading}
                          </h2>
                          {section.body && (
                            <div
                              className="text-sm md:text-base text-stone-200 max-w-xl mx-auto leading-relaxed mb-6"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(section.body),
                              }}
                            />
                          )}
                          {section.ctaLabel && (
                            <div className="mt-4">
                              <span className="inline-block px-5 py-2.5 rounded-xl font-medium text-xs bg-white text-stone-900 shadow-md">
                                {section.ctaLabel}
                              </span>
                            </div>
                          )}
                          {section.imageUrl && (
                            <div className="mt-6 max-w-md mx-auto rounded-xl overflow-hidden shadow-lg max-h-56">
                              <img
                                src={section.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. RICH TEXT BLOCK */}
                      {section.type === "text" && (
                        <div>
                          <h2
                            className="text-xl md:text-2xl font-serif font-semibold text-stone-900 mb-3"
                            style={{ fontFamily: themeConfig.fontPairing.headingFamily }}
                          >
                            {section.heading}
                          </h2>
                          <div
                            className="text-xs md:text-sm text-stone-600 leading-relaxed rich-text-body space-y-2"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(section.body || ""),
                            }}
                          />
                        </div>
                      )}

                      {/* 3. IMAGE BLOCK */}
                      {section.type === "image" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-2">
                            {section.heading}
                          </h3>
                          {section.imageUrl ? (
                            <div className="rounded-xl overflow-hidden max-h-80 border border-stone-200 shadow-xs">
                              <img
                                src={section.imageUrl}
                                alt={section.heading}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-48 rounded-xl bg-stone-100 border border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400">
                              <ImageIcon className="w-8 h-8 mb-1" />
                              <span className="text-xs">No image uploaded yet</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. GALLERY BLOCK */}
                      {section.type === "gallery" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-3">
                            {section.heading}
                          </h3>
                          <div className="grid grid-cols-3 gap-2">
                            {(section.galleryImages && section.galleryImages.length > 0
                              ? section.galleryImages
                              : [1, 2, 3]
                            ).map((img, i) => (
                              <div
                                key={i}
                                className="aspect-square rounded-xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center"
                              >
                                {typeof img === "string" ? (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Sparkles className="w-5 h-5 text-stone-300" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 5. SERVICES BLOCK */}
                      {section.type === "services" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-3">
                            {section.heading}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { name: "Classic Gel Manicure", time: "45m", price: "€45" },
                              { name: "Luxury Russian Pedicure", time: "60m", price: "€65" },
                            ].map((s) => (
                              <div
                                key={s.name}
                                className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 flex justify-between items-center text-xs"
                              >
                                <div>
                                  <strong className="block text-stone-800">{s.name}</strong>
                                  <span className="text-[10px] text-stone-400">{s.time}</span>
                                </div>
                                <span className="font-semibold text-stone-900">{s.price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 6. EMPLOYEES BLOCK */}
                      {section.type === "employees" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-3">
                            {section.heading}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { name: "Elena V.", role: "Lead Nail Stylist" },
                              { name: "Maya S.", role: "Nail Art Specialist" },
                            ].map((emp) => (
                              <div
                                key={emp.name}
                                className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 flex items-center gap-3 text-xs"
                              >
                                <div className="w-8 h-8 rounded-full bg-[#b26c59] text-white font-bold flex items-center justify-center text-xs">
                                  {emp.name.slice(0, 2)}
                                </div>
                                <div>
                                  <strong className="block text-stone-800">{emp.name}</strong>
                                  <span className="text-[10px] text-stone-400">{emp.role}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 7. BOOKING BLOCK */}
                      {section.type === "booking" && (
                        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                          <Calendar className="w-6 h-6 text-[#b26c59] mx-auto mb-2" />
                          <h4 className="text-xs font-semibold text-stone-800">
                            {section.heading || "Reserve an Appointment"}
                          </h4>
                          <p className="text-[11px] text-stone-500 mt-1 mb-3">
                            Customer picks artist, date, and time slot.
                          </p>
                          <div className="flex justify-center gap-2">
                            {["10:00", "11:30", "14:00", "15:30"].map((slot) => (
                              <span
                                key={slot}
                                className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[10px] font-medium text-stone-700"
                              >
                                {slot}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 8. TESTIMONIALS BLOCK */}
                      {section.type === "testimonials" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-3">
                            {section.heading}
                          </h3>
                          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50">
                            <div className="flex gap-1 text-amber-400 mb-1.5">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} className="w-3.5 h-3.5 fill-current" />
                              ))}
                            </div>
                            <p className="text-xs text-stone-600 italic mb-2">
                              "The most meticulous manicure I have ever had! The atmosphere is serene and relaxing."
                            </p>
                            <span className="text-[10px] font-semibold text-stone-800 block">
                              — Sophie L.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 9. CONTACT BLOCK */}
                      {section.type === "contact" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-3">
                            {section.heading}
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-xs text-stone-600">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                              <span>Studio 4B, Fashion District</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                              <span>Mon–Sat: 09:00 – 19:00</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                              <span>+33 1 23 45 67 89</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                              <span>contact@studio.com</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 10. CUSTOM HTML BLOCK */}
                      {section.type === "custom_html" && (
                        <div>
                          <h3 className="text-base font-semibold text-stone-900 mb-2">
                            {section.heading}
                          </h3>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(section.body || "<p>Custom HTML</p>"),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </main>

        {/* RIGHT ASIDE: BLOCK INSPECTOR (WMS-015) */}
        <aside className="w-80 bg-white border-l border-stone-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <span className="text-xs uppercase font-bold tracking-wider text-stone-400">
              Block Inspector
            </span>
            {selected && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 font-semibold text-stone-700">
                {selected.type}
              </span>
            )}
          </div>

          {selected ? (
            <div className="space-y-4">
              {/* Block Type */}
              <label className="block text-xs font-semibold text-stone-700">
                Section Type
                <select
                  value={selected.type}
                  onChange={(e) => updateSection({ type: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                >
                  {blockTypes.map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Heading */}
              <label className="block text-xs font-semibold text-stone-700">
                Heading
                <input
                  value={selected.heading}
                  onChange={(e) => updateSection({ heading: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-[#b26c59]"
                />
              </label>

              {/* HERO BLOCK SPECIFIC FIELDS (WMS-015) */}
              {selected.type === "hero" && (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#b26c59] block">
                    Hero Settings
                  </span>
                  <label className="block text-xs text-stone-700">
                    CTA Button Label
                    <input
                      placeholder="e.g. Book an Appointment"
                      value={selected.ctaLabel || ""}
                      onChange={(e) => updateSection({ ctaLabel: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                    />
                  </label>
                  <label className="block text-xs text-stone-700">
                    CTA Link URL
                    <input
                      placeholder="e.g. #booking or /sites/slug/booking"
                      value={selected.ctaUrl || ""}
                      onChange={(e) => updateSection({ ctaUrl: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                    />
                  </label>
                  <label className="block text-xs text-stone-700">
                    Background Image URL
                    <input
                      placeholder="https://... or upload below"
                      value={selected.backgroundImageUrl || ""}
                      onChange={(e) => updateSection({ backgroundImageUrl: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                    />
                  </label>
                </div>
              )}

              {/* RICH TEXT FORMATTING TOOLBAR & BODY (WMS-015) */}
              {["hero", "text", "services", "contact", "custom_html"].includes(selected.type) && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-stone-700">
                      Content Body
                    </span>
                    <span className="text-[10px] text-stone-400">HTML Supported</span>
                  </div>

                  {/* Toolbar */}
                  <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg border border-stone-200 mb-2">
                    <button
                      type="button"
                      title="Bold"
                      onClick={() => applyRichFormatting("bold")}
                      className="p-1 hover:bg-white rounded text-stone-700 transition-colors cursor-pointer"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Italic"
                      onClick={() => applyRichFormatting("italic")}
                      className="p-1 hover:bg-white rounded text-stone-700 transition-colors cursor-pointer"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Bullet List"
                      onClick={() => applyRichFormatting("bullet")}
                      className="p-1 hover:bg-white rounded text-stone-700 transition-colors cursor-pointer"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Numbered List"
                      onClick={() => applyRichFormatting("number")}
                      className="p-1 hover:bg-white rounded text-stone-700 transition-colors cursor-pointer"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Insert Link"
                      onClick={() => applyRichFormatting("link")}
                      className="p-1 hover:bg-white rounded text-stone-700 transition-colors cursor-pointer"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                    </button>
                    <span className="h-3 w-px bg-stone-300 mx-0.5" />
                    <button
                      type="button"
                      title="Clear Formatting"
                      onClick={() => applyRichFormatting("clear")}
                      className="p-1 hover:bg-white rounded text-stone-700 transition-colors cursor-pointer"
                    >
                      <RemoveFormatting className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={selected.body ?? ""}
                    onChange={(e) => updateSection({ body: e.target.value })}
                    placeholder="Write formatted content or HTML markup…"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-[#b26c59] font-mono leading-relaxed resize-y"
                  />
                </div>
              )}

              {/* DRAG-AND-DROP FILE UPLOAD ZONE (WMS-015) */}
              {["image", "gallery", "hero"].includes(selected.type) && (
                <div>
                  <span className="text-xs font-semibold text-stone-700 block mb-1.5">
                    {selected.type === "gallery" ? "Gallery Assets" : "Image Asset"}
                  </span>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setUploadDropActive(true);
                    }}
                    onDragLeave={() => setUploadDropActive(false)}
                    onDrop={(e) => void handleDropImage(e)}
                    className={`p-4 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${
                      uploadDropActive
                        ? "border-[#b26c59] bg-[#b26c59]/5 scale-102"
                        : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
                    }`}
                  >
                    <Upload className="w-6 h-6 mx-auto text-stone-400 mb-1.5" />
                    <p className="text-xs font-medium text-stone-700">
                      {uploadingImage ? "Uploading…" : "Drop image here or browse"}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleFileInput(e)}
                      className="mt-2 text-[10px] text-stone-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-white file:text-stone-700 file:shadow-xs hover:file:bg-stone-50 cursor-pointer"
                    />
                  </div>

                  {/* Uploaded Preview */}
                  {selected.imageUrl && selected.type !== "gallery" && (
                    <div className="mt-2 relative rounded-xl overflow-hidden border border-stone-200 group">
                      <img
                        src={selected.imageUrl}
                        alt="Preview"
                        className="w-full h-32 object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => updateSection({ imageUrl: undefined })}
                        className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-stone-900/70 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Gallery Multiple Images List */}
                  {selected.type === "gallery" && selected.galleryImages && selected.galleryImages.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {selected.galleryImages.map((url, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border border-stone-200 aspect-square group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            aria-label="Remove gallery image"
                            onClick={() => {
                              const next = selected.galleryImages?.filter((_, idx) => idx !== i);
                              updateSection({ galleryImages: next });
                            }}
                            className="absolute top-1 right-1 p-0.5 rounded bg-stone-900/70 text-white hover:bg-rose-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <span className="text-3xl text-stone-300 mb-2">↖</span>
              <p className="text-xs">
                Click on any section block on the canvas to inspect and edit its content, imagery, and layout.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* FULL PREVIEW MODAL (WMS-016) */}
      {fullPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-stone-900/90 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="h-14 bg-white/95 border-b border-stone-200 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#b26c59]" />
              <strong className="text-sm font-semibold text-stone-900">
                Full Public Preview — {active.title}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setFullPreviewOpen(false)}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
            <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden my-auto p-6">
              <div className="py-2 mb-6 border-b border-stone-100 flex items-center justify-between">
                <span className="font-serif font-bold text-lg text-stone-900">
                  {website?.name || websiteName}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                  /{active.slug}
                </span>
              </div>
              <div className="space-y-6">
                {active.sections.map((section) => (
                  <div key={section.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                    <h3 className="text-lg font-serif font-semibold text-stone-900 mb-2">
                      {section.heading}
                    </h3>
                    {section.body && (
                      <div
                        className="text-sm text-stone-600 leading-relaxed mb-4"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(section.body),
                        }}
                      />
                    )}
                    {section.imageUrl && (
                      <img
                        src={section.imageUrl}
                        alt=""
                        className="rounded-xl max-h-64 object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP NAVIGATION GUARD CONFIRMATION (WMS-014) */}
      <ConfirmDialog
        isOpen={navGuardOpen}
        title="Unsaved Changes"
        description="You have unsaved changes on this page. Are you sure you want to leave without saving?"
        confirmLabel="Leave Without Saving"
        isDestructive={true}
        onConfirm={() => {
          setNavGuardOpen(false);
          setHasUnsavedChanges(false);
          onBack();
        }}
        onCancel={() => setNavGuardOpen(false)}
      />

      {/* DELETE PAGE CONFIRMATION */}
      <ConfirmDialog
        isOpen={deleteConfirmTarget !== null}
        title="Delete page"
        description={`Are you sure you want to delete "${deleteConfirmTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={() => void confirmDeletePage()}
        onCancel={() => setDeleteConfirmTarget(null)}
      />
    </section>
  );
}
