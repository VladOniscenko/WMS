import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  AlertCircle,
  Sparkles,
  Smartphone,
  Monitor,
  Upload,
  X,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
} from "lucide-react";
import { employeesApi, type EmployeeProfile } from "@modules/employees";
import { customersApi, type CustomerProfile } from "@modules/customers";
import { agendaApi, type Reservation } from "@modules/agenda";
import { catalogApi, type CatalogService } from "@modules/cms";
import { EmployeeScheduleModal } from "./EmployeeScheduleModal";
import { httpClient } from "@shared/api/httpClient";
import { useToast } from "@shared/ui/Toast";
import { usePages, useCreatePage } from "@shared/queries";
import { THEMES, getTheme, type ThemeId } from "@shared/theme/themes";

async function uploadAsset(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await httpClient.post<{ url: string }>("/api/assets", formData);
  return data.url;
}

function SkillTagsInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [val, setVal] = useState("");

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/^,+|,+$/g, "");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setVal("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(val);
    } else if (e.key === "Backspace" && !val && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 min-h-[26px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200"
          >
            <span>{tag}</span>
            <button
              type="button"
              className="text-stone-400 hover:text-stone-700 ml-0.5 cursor-pointer leading-none text-sm"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="Type a skill tag and press Enter or comma…"
        value={val}
        onChange={(e) => {
          if (e.target.value.includes(",")) {
            const parts = e.target.value.split(",");
            parts.forEach((p) => {
              if (p.trim()) addTag(p);
            });
          } else {
            setVal(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
      />
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmployeesManagement({ websiteId }: { websiteId: string }) {
  const [items, setItems] = useState<EmployeeProfile[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    roleTitle: "Nail artist",
    bio: "",
    avatarUrl: "",
    skillTags: [] as string[],
    serviceIds: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    displayName: "",
    email: "",
    roleTitle: "",
    bio: "",
    avatarUrl: "",
    skillTags: [] as string[],
    serviceIds: [] as string[],
  });

  const [scheduleEmployee, setScheduleEmployee] = useState<EmployeeProfile | null>(null);

  const toast = useToast();

  async function load() {
    try {
      setItems((await employeesApi.list()).data);
    } catch {
      toast.error("Employees could not be loaded. Select a business first.");
    }

    try {
      const res = await catalogApi.list(websiteId);
      setServices(res.data || []);
    } catch {
      // Services catalog load fallback
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAvatarUpload(file: File, isEdit: boolean) {
    setUploading(true);
    try {
      const url = await uploadAsset(file);
      if (isEdit) {
        setEditForm((prev) => ({ ...prev, avatarUrl: url }));
      } else {
        setForm((prev) => ({ ...prev, avatarUrl: url }));
      }
      toast.success("Avatar image uploaded.");
    } catch {
      toast.error("Failed to upload avatar image.");
    } finally {
      setUploading(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await employeesApi.create({
        ...form,
        assignedWebsiteIds: [websiteId],
        isActive: true,
      });
      setForm({
        displayName: "",
        email: "",
        roleTitle: "Nail artist",
        bio: "",
        avatarUrl: "",
        skillTags: [],
        serviceIds: [],
      });
      toast.success("Employee added successfully.");
      await load();
    } catch {
      toast.error("Employee could not be created.");
    }
  }

  function startEditing(employee: EmployeeProfile) {
    setEditingEmployee(employee);
    setEditForm({
      displayName: employee.displayName,
      email: employee.email,
      roleTitle: employee.roleTitle || "",
      bio: employee.bio || "",
      avatarUrl: employee.avatarUrl || "",
      skillTags: employee.skillTags || [],
      serviceIds: employee.serviceIds || [],
    });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingEmployee) return;

    try {
      await employeesApi.update(editingEmployee.id, {
        ...editingEmployee,
        ...editForm,
      });
      toast.success("Employee updated successfully.");
      setEditingEmployee(null);
      await load();
    } catch {
      toast.error("Failed to update employee.");
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="People"
        title="Employees"
        action={
          <button
            className="button primary inline-flex items-center gap-1.5 cursor-pointer"
            onClick={() =>
              document
                .getElementById("new-employee")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Plus className="w-4 h-4" />
            Add employee
          </button>
        }
      />
      <div className="management-grid">
        <div className="card-list">
          {items.map((item) => (
            <article className="card management-card" key={item.id}>
              {item.avatarUrl ? (
                <img
                  src={item.avatarUrl}
                  alt={item.displayName}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-stone-200 shadow-xs"
                />
              ) : (
                <div className="avatar font-bold text-sm">
                  {item.displayName ? item.displayName[0].toUpperCase() : "E"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate">{item.displayName}</h3>
                  <small className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                    {item.isActive ? "Active" : "Archived"}
                  </small>
                </div>
                <p className="text-xs text-stone-600 truncate">
                  {item.roleTitle || "Specialist"} · {item.email}
                </p>

                {/* Skill tags chips */}
                {item.skillTags && item.skillTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.skillTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-stone-100 text-stone-600 border border-stone-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Assigned services preview */}
                <div className="mt-1 text-[11px] text-stone-500">
                  {item.serviceIds && item.serviceIds.length > 0
                    ? `${item.serviceIds.length} service${item.serviceIds.length === 1 ? "" : "s"} assigned`
                    : "No services assigned"}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  className="button small secondary inline-flex items-center gap-1 cursor-pointer"
                  onClick={() => startEditing(item)}
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="button small secondary inline-flex items-center gap-1 cursor-pointer"
                  onClick={() => setScheduleEmployee(item)}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Schedule</span>
                </button>
                <button
                  type="button"
                  className="button small secondary cursor-pointer"
                  onClick={() =>
                    void employeesApi
                      .update(item.id, { ...item, isActive: !item.isActive })
                      .then(() => {
                        toast.success(
                          item.isActive
                            ? "Employee archived."
                            : "Employee restored."
                        );
                        return load();
                      })
                  }
                >
                  {item.isActive ? "Archive" : "Restore"}
                </button>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="empty-state">
              <h3>No employees yet</h3>
              <p>Add your team so customers can choose who they book with.</p>
            </div>
          )}
        </div>

        {/* Create Employee Form */}
        <form
          id="new-employee"
          className="builder-form"
          onSubmit={(event) => void create(event)}
        >
          <h3>Add employee</h3>

          {/* Avatar Upload with Circular Preview */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Profile Avatar
            </label>
            <div className="flex items-center gap-3">
              {form.avatarUrl ? (
                <img
                  src={form.avatarUrl}
                  alt="Avatar preview"
                  className="w-14 h-14 rounded-full object-cover border border-stone-200 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-stone-100 border border-dashed border-stone-300 flex items-center justify-center text-stone-400 text-xs">
                  <User className="w-6 h-6" />
                </div>
              )}
              <label className="button small secondary inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? "Uploading…" : "Upload photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAvatarUpload(f, false);
                  }}
                />
              </label>
            </div>
          </div>

          <input
            required
            placeholder="Full name"
            value={form.displayName}
            onChange={(event) =>
              setForm({ ...form, displayName: event.target.value })
            }
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
          <input
            placeholder="Role (e.g. Master Stylist, Senior Nailist)"
            value={form.roleTitle}
            onChange={(event) =>
              setForm({ ...form, roleTitle: event.target.value })
            }
          />
          <textarea
            placeholder="Short bio"
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
          />

          {/* Interactive Skill Tags UI */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Skills & Specialties
            </label>
            <SkillTagsInput
              tags={form.skillTags}
              onChange={(skillTags) => setForm({ ...form, skillTags })}
            />
          </div>

          {/* Service Assignment Multi-Select Checklist */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Assigned Services ({form.serviceIds.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 border border-stone-200 rounded-lg bg-stone-50/50">
              {services.map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(svc.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm({
                        ...form,
                        serviceIds: checked
                          ? [...form.serviceIds, svc.id]
                          : form.serviceIds.filter((id) => id !== svc.id),
                      });
                    }}
                  />
                  <span className="truncate">{svc.name}</span>
                </label>
              ))}
              {services.length === 0 && (
                <p className="text-xs text-stone-400 col-span-2">No services available yet.</p>
              )}
            </div>
          </div>

          <button className="button primary cursor-pointer">Add employee</button>
        </form>
      </div>

      {/* Edit Employee Drawer / Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setEditingEmployee(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
              <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">
                    Edit Employee
                  </h2>
                  <p className="text-xs text-stone-500">
                    Update profile, role, avatar, skills, and assigned services.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => void saveEdit(e)} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Avatar upload in edit drawer */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Avatar photo
                  </label>
                  <div className="flex items-center gap-3">
                    {editForm.avatarUrl ? (
                      <img
                        src={editForm.avatarUrl}
                        alt="Avatar preview"
                        className="w-14 h-14 rounded-full object-cover border border-stone-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-stone-100 border border-dashed border-stone-300 flex items-center justify-center text-stone-400 text-xs">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <label className="button small secondary inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploading ? "Uploading…" : "Change photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleAvatarUpload(f, true);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Display name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Role Title
                  </label>
                  <input
                    value={editForm.roleTitle}
                    onChange={(e) => setEditForm({ ...editForm, roleTitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Biography
                  </label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                {/* Skill tags */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Skill tags
                  </label>
                  <SkillTagsInput
                    tags={editForm.skillTags}
                    onChange={(skillTags) => setEditForm({ ...editForm, skillTags })}
                  />
                </div>

                {/* Service assignment checklist */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Assigned Services ({editForm.serviceIds.length} selected)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-stone-200 rounded-lg bg-stone-50/50">
                    {services.map((svc) => (
                      <label key={svc.id} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.serviceIds.includes(svc.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditForm({
                              ...editForm,
                              serviceIds: checked
                                ? [...editForm.serviceIds, svc.id]
                                : editForm.serviceIds.filter((id) => id !== svc.id),
                            });
                          }}
                        />
                        <span className="truncate">{svc.name}</span>
                      </label>
                    ))}
                    {services.length === 0 && (
                      <p className="text-xs text-stone-400 col-span-2">No services available.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="button secondary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button primary cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {scheduleEmployee && (
        <EmployeeScheduleModal
          employee={scheduleEmployee}
          onClose={() => setScheduleEmployee(null)}
          onSaved={() => {
            void load();
          }}
        />
      )}
    </section>
  );
}

export function ServicesManagement({ websiteId }: { websiteId?: string }) {
  const [items, setItems] = useState<CatalogService[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 60,
    price: 0,
    currency: "EUR",
    category: "Manicure",
    imageUrl: "",
    isActive: true,
  });
  const toast = useToast();

  const categories = [
    "Manicure",
    "Pedicure",
    "Nail Art",
    "Treatment",
    "Package",
    "Other",
  ];

  async function load() {
    try {
      setItems((await catalogApi.list(websiteId)).data);
    } catch {
      toast.error("Could not load services.");
    }
  }

  useEffect(() => {
    void load();
  }, [websiteId]);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadAsset(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Service image uploaded successfully.");
    } catch {
      toast.error("Failed to upload service image.");
    } finally {
      setUploading(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await catalogApi.create({ ...form, websiteId });
      setForm({
        name: "",
        description: "",
        durationMinutes: 60,
        price: 0,
        currency: "EUR",
        category: "Manicure",
        imageUrl: "",
        isActive: true,
      });
      toast.success("Service created successfully.");
      await load();
    } catch {
      toast.error("Failed to create service.");
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Catalog"
        title="Services"
        action={
          <span className="status published">
            {items.filter((x) => x.isActive).length} active
          </span>
        }
      />
      <div className="management-grid">
        <div className="card-list">
          {items.map((item) => (
            <article className="card management-card" key={item.id}>
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-14 h-14 rounded-lg object-cover border border-stone-200 shrink-0 shadow-xs"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="truncate">{item.name}</h3>
                  {item.category && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                      {item.category}
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Website Scoped
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5">
                  {item.durationMinutes} min · {item.price} {item.currency}
                </p>
                <small className="text-stone-500 block truncate">{item.description || "No description"}</small>
              </div>
              <button
                type="button"
                className="button small secondary cursor-pointer"
                onClick={() =>
                  void catalogApi
                    .update(item.id, { isActive: !item.isActive })
                    .then(() => {
                      toast.success(
                        item.isActive
                          ? "Service disabled."
                          : "Service enabled."
                      );
                      return load();
                    })
                }
              >
                {item.isActive ? "Disable" : "Enable"}
              </button>
            </article>
          ))}
          {items.length === 0 && (
            <div className="empty-state">
              <h3>No services yet</h3>
              <p>Create your first service so clients can view and book online.</p>
            </div>
          )}
        </div>

        {/* Create Service Form */}
        <form className="builder-form" onSubmit={(event) => void create(event)}>
          <h3>Add service</h3>

          {/* Service Image Upload */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Service Image
            </label>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <img
                  src={form.imageUrl}
                  alt="Service preview"
                  className="w-14 h-14 rounded-lg object-cover border border-stone-200 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-stone-100 border border-dashed border-stone-300 flex items-center justify-center text-stone-400 text-xs">
                  No image
                </div>
              )}
              <label className="button small secondary inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? "Uploading…" : "Upload image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImageUpload(f);
                  }}
                />
              </label>
            </div>
          </div>

          <input
            required
            placeholder="Service name (e.g. Signature Gel Manicure)"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />

          {/* Category Dropdown Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <textarea
            placeholder="Description of this treatment and what it includes"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
          <div className="form-grid">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    durationMinutes: Number(event.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Price (EUR)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: Number(event.target.value) })
                }
              />
            </div>
          </div>
          <button className="button primary cursor-pointer">Create service</button>
        </form>
      </div>
    </section>
  );
}

export function CustomersManagement({
  websiteId: _websiteId,
}: {
  websiteId: string;
}) {
  const [items, setItems] = useState<CustomerProfile[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [customerReservations, setCustomerReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const toast = useToast();
  const pageSize = 25;

  // 300 ms debounce for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch customers when debouncedSearch or page changes
  useEffect(() => {
    let active = true;
    async function loadCustomers() {
      setLoading(true);
      try {
        const res = await customersApi.list(debouncedSearch, page, pageSize);
        if (active) {
          setItems(res.data.items || []);
          setTotal(res.data.total || 0);
        }
      } catch {
        toast.error("Failed to load customers.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadCustomers();
    return () => {
      active = false;
    };
  }, [debouncedSearch, page]);

  async function openCustomerPanel(customer: CustomerProfile) {
    setSelectedCustomer(customer);
    setLoadingReservations(true);
    try {
      const res = await agendaApi.list({});
      const filtered = (res.data || []).filter(
        (r) =>
          r.clientId === customer.id ||
          (customer.email &&
            r.clientSnapshot?.email?.toLowerCase() ===
              customer.email.toLowerCase())
      );
      setCustomerReservations(filtered);
    } catch {
      setCustomerReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section>
      <PageHeader
        eyebrow="Relationships"
        title="Customers"
        action={
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              className="search-input pl-9"
              placeholder="Search customers by name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      />

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Websites visited</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => void openCustomerPanel(item)}
                className="cursor-pointer hover:bg-stone-50/80 transition-colors"
              >
                <td>
                  <strong>
                    {[item.firstName, item.lastName]
                      .filter(Boolean)
                      .join(" ") || "Unnamed customer"}
                  </strong>
                </td>
                <td>{item.email}</td>
                <td>{item.phone || "—"}</td>
                <td>{item.visitedWebsiteIds?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state echoing search query */}
        {!loading && items.length === 0 && (
          <div className="empty-state">
            <h3>No customers found</h3>
            <p>
              {debouncedSearch
                ? `No customers found matching "${debouncedSearch}".`
                : "Customers will appear here after they create an account or make a booking."}
            </p>
          </div>
        )}

        {/* Pagination controls */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50/50 text-xs text-stone-600">
            <div>
              Showing {Math.min((page - 1) * pageSize + 1, total)}–
              {Math.min(page * pageSize, total)} of {total} customers (Page {page} of {totalPages})
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="button small secondary inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="font-semibold px-2">{page}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="button small secondary inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Details & Reservation History Side Panel */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
              <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#b26c59] text-white flex items-center justify-center font-bold text-sm">
                    {selectedCustomer.firstName
                      ? selectedCustomer.firstName[0].toUpperCase()
                      : "C"}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">
                      {[selectedCustomer.firstName, selectedCustomer.lastName]
                        .filter(Boolean)
                        .join(" ") || "Customer Details"}
                    </h2>
                    <p className="text-xs text-stone-500">{selectedCustomer.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Profile details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Contact & Preferences
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-stone-50 border border-stone-100">
                      <span className="text-stone-400 block mb-0.5">Phone</span>
                      <strong className="text-stone-800">{selectedCustomer.phone || "—"}</strong>
                    </div>
                    <div className="p-3 rounded-lg bg-stone-50 border border-stone-100">
                      <span className="text-stone-400 block mb-0.5">Marketing</span>
                      <strong className={selectedCustomer.consentMarketing ? "text-emerald-700" : "text-stone-600"}>
                        {selectedCustomer.consentMarketing ? "Subscribed" : "Not opted in"}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-50 border border-stone-100 text-xs">
                    <span className="text-stone-400 block mb-0.5">Address</span>
                    <strong className="text-stone-800">
                      {[
                        selectedCustomer.addressLine,
                        selectedCustomer.city,
                        selectedCustomer.postalCode,
                        selectedCustomer.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "No address on file"}
                    </strong>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-50 border border-stone-100 text-xs">
                    <span className="text-stone-400 block mb-0.5">Websites Visited</span>
                    <strong className="text-stone-800">
                      {selectedCustomer.visitedWebsiteIds?.length || 0} website(s)
                    </strong>
                  </div>
                </div>

                {/* Reservation history */}
                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                      Reservation History ({customerReservations.length})
                    </h3>
                  </div>

                  {loadingReservations ? (
                    <p className="text-xs text-stone-400 py-4 text-center">Loading reservations…</p>
                  ) : customerReservations.length === 0 ? (
                    <p className="text-xs text-stone-500 bg-stone-50 p-4 rounded-lg border border-stone-100 text-center">
                      No reservations found for this customer.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {customerReservations.map((res) => (
                        <div
                          key={res.id}
                          className="p-3.5 rounded-xl border border-stone-200 bg-white shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-semibold text-stone-900">
                                {res.serviceSnapshot?.serviceName || "Appointment"}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-1">
                                <Calendar className="w-3 h-3 text-stone-400" />
                                <span>
                                  {new Date(res.startAtUtc).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                <Clock className="w-3 h-3 text-stone-400 ml-1" />
                                <span>
                                  {new Date(res.startAtUtc).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                              {res.status || "Confirmed"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export { AgendaManagement } from "@modules/agenda";

type ManagedWebsite = {
  id: string;
  name: string;
  domainOrSlug: string;
  category: string;
  enabledModules: string[];
  themeConfig: {
    primaryColor?: string;
    logoUrl?: string;
    font?: string;
    themeId?: string;
  };
  content?: {
    title?: string;
    tagline?: string;
    heroText?: string;
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

function NavigationLinksEditor({
  websiteId,
  items,
  onChange,
}: {
  websiteId: string;
  items: Array<{ label: string; pageSlug: string }>;
  onChange: (items: Array<{ label: string; pageSlug: string }>) => void;
}) {
  const { data: pages = [], isLoading: isLoadingPages } = usePages(websiteId);
  const createPageMutation = useCreatePage(websiteId);
  const toast = useToast();

  const [creatingForIndex, setCreatingForIndex] = useState<number | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [customRows, setCustomRows] = useState<Record<number, boolean>>({});

  const isPageValid = (slug: string) => {
    if (!slug) return false;
    if (
      slug.startsWith("http://") ||
      slug.startsWith("https://") ||
      slug.startsWith("#") ||
      slug.startsWith("/")
    ) {
      return true;
    }
    return pages.some((p) => p.slug === slug);
  };

  const updateItem = (
    index: number,
    patch: Partial<{ label: string; pageSlug: string }>,
  ) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    );
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const updated = [...items];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    onChange(updated);
  };

  const addItem = () => {
    const defaultSlug = pages[0]?.slug || "home";
    onChange([...items, { label: "New Link", pageSlug: defaultSlug }]);
  };

  const handleStartCreatePage = (index: number, label: string) => {
    setCreatingForIndex(index);
    const title = label && label !== "New Link" ? label : "New Page";
    setNewPageTitle(title);
    setNewPageSlug(title.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
  };

  const handleConfirmCreatePage = async (index: number) => {
    if (!newPageTitle.trim() || !newPageSlug.trim()) return;
    try {
      await createPageMutation.mutateAsync({
        title: newPageTitle.trim(),
        slug: newPageSlug.trim().toLowerCase(),
        status: "Published",
        showInNavigation: true,
      });
      toast.success(`Page "${newPageTitle}" created and linked.`);
      updateItem(index, {
        label: newPageTitle,
        pageSlug: newPageSlug.trim().toLowerCase(),
      });
      setCreatingForIndex(null);
    } catch {
      toast.error("Could not create page. Ensure the slug is unique.");
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isKnownPage = pages.some((p) => p.slug === item.pageSlug);
        const isCustom = customRows[index] ?? !isKnownPage;
        const isValid = isPageValid(item.pageSlug);

        return (
          <div
            key={index}
            className="p-3 bg-stone-50/90 border border-stone-200 rounded-xl space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-stone-200 text-stone-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  disabled={index === 0}
                  onClick={() => moveUp(index)}
                  title="Move link up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-stone-200 text-stone-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  disabled={index === items.length - 1}
                  onClick={() => moveDown(index)}
                  title="Move link down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-[130px]">
                <input
                  placeholder="Link label"
                  value={item.label}
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  className="w-full text-sm py-1.5 px-2.5 rounded-lg border border-stone-200 bg-white"
                />
              </div>

              <div className="flex-1 min-w-[160px]">
                <select
                  value={isCustom ? "__custom__" : item.pageSlug}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__create_new__") {
                      handleStartCreatePage(index, item.label);
                    } else if (val === "__custom__") {
                      setCustomRows((prev) => ({ ...prev, [index]: true }));
                    } else {
                      setCustomRows((prev) => ({ ...prev, [index]: false }));
                      updateItem(index, { pageSlug: val });
                    }
                  }}
                  className="w-full text-sm py-1.5 px-2.5 rounded-lg border border-stone-200 bg-white"
                >
                  <optgroup label="Website Pages">
                    {pages.map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.title} (/{p.slug})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Options">
                    <option value="__custom__">🔗 Custom URL / External</option>
                    <option value="__create_new__">
                      ✨ + Create new page…
                    </option>
                  </optgroup>
                </select>
              </div>

              <button
                type="button"
                className="p-2 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                onClick={() => removeItem(index)}
                title="Remove link"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {isCustom && (
              <div className="flex items-center gap-2 pl-7">
                <input
                  placeholder="Custom target (e.g. /custom-url or https://...)"
                  value={item.pageSlug}
                  onChange={(e) =>
                    updateItem(index, { pageSlug: e.target.value })
                  }
                  className="w-full text-sm py-1.5 px-2.5 rounded-lg border border-stone-200 bg-white text-stone-700 font-mono text-xs"
                />
              </div>
            )}

            {creatingForIndex === index && (
              <div className="ml-7 p-3 bg-white border border-[#e0a68d] rounded-lg space-y-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8d4e40]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create new page and link to this item</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Page title"
                    value={newPageTitle}
                    onChange={(e) => {
                      setNewPageTitle(e.target.value);
                      setNewPageSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, "-"),
                      );
                    }}
                    className="text-xs p-1.5 rounded border border-stone-200"
                  />
                  <input
                    placeholder="Page slug"
                    value={newPageSlug}
                    onChange={(e) => setNewPageSlug(e.target.value)}
                    className="text-xs p-1.5 rounded border border-stone-200 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="button small secondary text-xs py-1"
                    onClick={() => setCreatingForIndex(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button small primary text-xs py-1"
                    disabled={
                      createPageMutation.isPending ||
                      !newPageTitle ||
                      !newPageSlug
                    }
                    onClick={() => void handleConfirmCreatePage(index)}
                  >
                    {createPageMutation.isPending
                      ? "Creating…"
                      : "Create & Link"}
                  </button>
                </div>
              </div>
            )}

            {!isLoadingPages && !isValid && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 pl-7">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Page slug &ldquo;{item.pageSlug}&rdquo; does not correspond to
                  an existing page.
                </span>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="button small secondary inline-flex items-center gap-1.5 w-full justify-center py-2 text-xs"
        onClick={addItem}
      >
        <Plus className="w-3.5 h-3.5" />
        Add navigation link
      </button>
    </div>
  );
}

export function ThemeManagement({
  website,
  onSaved,
}: {
  website: ManagedWebsite;
  onSaved: (website: ManagedWebsite) => void;
}) {
  const [theme, setTheme] = useState(website.themeConfig ?? {});
  const [content, setContent] = useState(website.content ?? {});
  const [alias, setAlias] = useState(website.domainOrSlug);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const toast = useToast();

  const selectedThemeId = (theme.themeId as ThemeId) || "editorial";
  const activeThemeConfig = getTheme(selectedThemeId);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await httpClient.put<ManagedWebsite>(
        `/api/websites/${website.id}`,
        {
          ...website,
          domainOrSlug: alias,
          themeConfig: theme,
          content,
        },
      );
      setAlias(response.data.domainOrSlug);
      toast.success("Website settings saved.");
      onSaved(response.data);
    } catch {
      toast.error(
        "Could not save website settings. Check the alias and try again.",
      );
    }
  }

  const handleSelectTheme = (themeId: ThemeId) => {
    const chosen = THEMES[themeId];
    setTheme((prev) => ({
      ...prev,
      themeId,
      primaryColor: prev.primaryColor || chosen.palette.primary,
      font: chosen.fontPairing.heading,
    }));
  };

  const navigation = content.navigation ?? {
    brandLabel: content.title ?? website.name,
    items: [{ label: "Home", pageSlug: "home" }],
    showBookingButton: true,
  };
  const footer = content.footer ?? {
    text: `© ${website.name}`,
    address: "",
    email: "",
    phone: "",
  };

  return (
    <section>
      <PageHeader eyebrow="Website design" title="Theme, navigation & footer" />

      {/* Multi-Theme Selector */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">
              Website Theme
            </h3>
            <p className="text-xs text-stone-500">
              Select one of the 3 handcrafted design themes to control layouts,
              headers, hero styles, and typography.
            </p>
          </div>
        </div>

        <div className="theme-selector-grid">
          {(Object.values(THEMES) as Array<typeof activeThemeConfig>).map(
            (t) => {
              const isSelected = selectedThemeId === t.id;
              return (
                <div
                  key={t.id}
                  className={`theme-card-option ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectTheme(t.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelectTheme(t.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-stone-900">
                      {t.name}
                    </h4>
                    {isSelected && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#b26c59] text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mb-3">{t.description}</p>

                  {/* Theme Specs Badges */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600 font-medium capitalize">
                      {t.heroLayout} hero
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600 font-medium capitalize">
                      {t.headerStyle} header
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600 font-medium capitalize">
                      {t.cardStyle} cards
                    </span>
                  </div>

                  {/* Color swatches */}
                  <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-stone-150">
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                      style={{ background: t.palette.primary }}
                      title={`Primary: ${t.palette.primary}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                      style={{ background: t.palette.secondary }}
                      title={`Secondary: ${t.palette.secondary}`}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                      style={{ background: t.palette.accent }}
                      title={`Accent: ${t.palette.accent}`}
                    />
                    <span className="text-[11px] text-stone-400 font-mono ml-auto">
                      {t.fontPairing.heading}
                    </span>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>

      <form
        className="builder-form wide-form"
        onSubmit={(event) => void save(event)}
      >
        <h3>Website identity</h3>
        <div className="form-grid">
          <label>
            Website alias
            <input
              required
              value={alias}
              onChange={(event) =>
                setAlias(
                  event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
                )
              }
            />
            <small>Public URL: /sites/{alias || "your-alias"}</small>
          </label>
          <label>
            Website title
            <input
              value={content.title ?? ""}
              onChange={(event) =>
                setContent({ ...content, title: event.target.value })
              }
            />
          </label>
          <label>
            Tagline
            <input
              value={content.tagline ?? ""}
              onChange={(event) =>
                setContent({ ...content, tagline: event.target.value })
              }
            />
          </label>
          <label>
            Hero message
            <textarea
              value={content.heroText ?? ""}
              onChange={(event) =>
                setContent({ ...content, heroText: event.target.value })
              }
            />
          </label>
          <label>
            Primary color
            <input
              type="color"
              value={theme.primaryColor ?? activeThemeConfig.palette.primary}
              onChange={(event) =>
                setTheme({ ...theme, primaryColor: event.target.value })
              }
            />
          </label>
          <label>
            Font
            <select
              value={theme.font ?? activeThemeConfig.fontPairing.heading}
              onChange={(event) =>
                setTheme({ ...theme, font: event.target.value })
              }
            >
              <option>Inter</option>
              <option>Georgia</option>
              <option>DM Sans</option>
              <option>Playfair Display</option>
            </select>
          </label>
        </div>

        {/* Dynamic Navigation Links Editor */}
        <h3>Navbar &amp; Navigation Links</h3>
        <div className="space-y-4 mb-4">
          <label>
            Brand label
            <input
              value={navigation.brandLabel ?? ""}
              onChange={(event) =>
                setContent({
                  ...content,
                  navigation: { ...navigation, brandLabel: event.target.value },
                })
              }
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Navigation links
              </span>
              <small className="text-stone-400 text-xs">
                Select existing pages, custom links, or create new pages
              </small>
            </div>
            <NavigationLinksEditor
              websiteId={website.id}
              items={navigation.items ?? []}
              onChange={(newItems) =>
                setContent({
                  ...content,
                  navigation: { ...navigation, items: newItems },
                })
              }
            />
          </div>

          <label className="checkbox-row pt-2">
            <input
              type="checkbox"
              checked={navigation.showBookingButton ?? true}
              onChange={(event) =>
                setContent({
                  ...content,
                  navigation: {
                    ...navigation,
                    showBookingButton: event.target.checked,
                  },
                })
              }
            />{" "}
            Show booking button
          </label>
        </div>

        <h3>Footer</h3>
        <div className="form-grid">
          <label>
            Footer text
            <input
              value={footer.text ?? ""}
              onChange={(event) =>
                setContent({
                  ...content,
                  footer: { ...footer, text: event.target.value },
                })
              }
            />
          </label>
          <label>
            Address
            <input
              value={footer.address ?? ""}
              onChange={(event) =>
                setContent({
                  ...content,
                  footer: { ...footer, address: event.target.value },
                })
              }
            />
          </label>
          <label>
            Email
            <input
              value={footer.email ?? ""}
              onChange={(event) =>
                setContent({
                  ...content,
                  footer: { ...footer, email: event.target.value },
                })
              }
            />
          </label>
          <label>
            Phone
            <input
              value={footer.phone ?? ""}
              onChange={(event) =>
                setContent({
                  ...content,
                  footer: { ...footer, phone: event.target.value },
                })
              }
            />
          </label>
        </div>

        {/* Live Interactive Side-by-Side Theme Preview */}
        <div className="mt-8 pt-6 border-t border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-stone-900 text-base">
                Interactive Live Preview: {activeThemeConfig.name}
              </h4>
              <p className="text-xs text-stone-500">
                Live preview rendering with active layout variant, header style,
                hero layout, and card style.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
              <button
                type="button"
                className={`p-1.5 rounded text-xs flex items-center gap-1 cursor-pointer ${
                  previewDevice === "desktop"
                    ? "bg-white text-stone-800 shadow-2xs font-medium"
                    : "text-stone-500 hover:text-stone-800"
                }`}
                onClick={() => setPreviewDevice("desktop")}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                className={`p-1.5 rounded text-xs flex items-center gap-1 cursor-pointer ${
                  previewDevice === "mobile"
                    ? "bg-white text-stone-800 shadow-2xs font-medium"
                    : "text-stone-500 hover:text-stone-800"
                }`}
                onClick={() => setPreviewDevice("mobile")}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>
          </div>

          <div
            className={`mx-auto transition-all duration-300 border border-stone-300 rounded-2xl shadow-lg overflow-hidden bg-white ${
              previewDevice === "mobile" ? "max-w-[360px]" : "w-full"
            }`}
          >
            {/* Mock browser address bar */}
            <div className="bg-stone-100 px-3 py-2 border-b border-stone-200 flex items-center gap-2 text-xs text-stone-500">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="flex-1 bg-white px-2.5 py-0.5 rounded text-[11px] text-stone-600 truncate border border-stone-200">
                https://yourdomain.com/sites/{alias || website.domainOrSlug}
              </span>
            </div>

            {/* Preview Document Viewport */}
            <div
              className={`theme-${selectedThemeId}`}
              style={{
                background: activeThemeConfig.palette.background,
                color: activeThemeConfig.palette.text,
                fontFamily: activeThemeConfig.fontPairing.bodyFamily,
              }}
            >
              {/* Preview Header */}
              <div
                className={`px-4 py-3 border-b flex items-center justify-between text-xs transition-colors ${
                  activeThemeConfig.headerStyle === "transparent"
                    ? "bg-stone-900/40 text-white border-transparent"
                    : activeThemeConfig.headerStyle === "sticky"
                      ? "bg-white/90 backdrop-blur-xs border-stone-200"
                      : "bg-white border-stone-200"
                }`}
              >
                <span
                  className="font-bold tracking-tight text-sm truncate"
                  style={{
                    fontFamily: activeThemeConfig.fontPairing.headingFamily,
                  }}
                >
                  {navigation.brandLabel || content.title || website.name}
                </span>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-[11px]">
                    {(navigation.items ?? []).slice(0, 3).map((item, idx) => (
                      <span
                        key={idx}
                        className="hover:underline cursor-pointer"
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                  {navigation.showBookingButton && (
                    <span
                      className="px-2 py-1 rounded text-[11px] font-semibold text-white shadow-2xs"
                      style={{
                        background:
                          theme.primaryColor ||
                          activeThemeConfig.palette.primary,
                      }}
                    >
                      Book now
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Hero */}
              {activeThemeConfig.heroLayout === "full-bleed" ? (
                <div
                  className="p-8 text-white relative overflow-hidden"
                  style={{
                    background: `linear-gradient(120deg, ${activeThemeConfig.palette.secondary}, ${
                      theme.primaryColor || activeThemeConfig.palette.primary
                    })`,
                  }}
                >
                  <p className="text-[10px] uppercase tracking-widest text-amber-200 font-semibold mb-1">
                    Featured
                  </p>
                  <h3
                    className="text-2xl sm:text-3xl font-serif font-bold mb-2 leading-tight"
                    style={{
                      fontFamily: activeThemeConfig.fontPairing.headingFamily,
                    }}
                  >
                    {content.title || website.name}
                  </h3>
                  <p className="text-xs text-stone-200 max-w-sm leading-relaxed mb-4">
                    {content.heroText ||
                      content.tagline ||
                      "Your website, your way."}
                  </p>
                  <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-900 bg-white shadow-sm">
                    Explore services
                  </span>
                </div>
              ) : (
                <div className="p-8 text-center max-w-lg mx-auto">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-2 bg-stone-200 text-stone-700">
                    Featured
                  </span>
                  <h3
                    className="text-2xl font-bold mb-2"
                    style={{
                      fontFamily: activeThemeConfig.fontPairing.headingFamily,
                    }}
                  >
                    {content.title || website.name}
                  </h3>
                  <p className="text-xs text-stone-600 mb-4 leading-relaxed">
                    {content.heroText ||
                      content.tagline ||
                      "Your website, your way."}
                  </p>
                  <span
                    className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm"
                    style={{
                      background:
                        theme.primaryColor || activeThemeConfig.palette.primary,
                    }}
                  >
                    Explore services
                  </span>
                </div>
              )}

              {/* Preview Sample Card */}
              <div className="p-4 sm:p-6">
                <div
                  className={`p-4 transition-all ${
                    activeThemeConfig.cardStyle === "rounded"
                      ? "rounded-2xl border border-stone-200 bg-white shadow-sm"
                      : activeThemeConfig.cardStyle === "bordered"
                        ? "rounded-none border-2 border-stone-800 bg-white shadow-none"
                        : "rounded-xl border-0 bg-stone-100 shadow-none"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5
                      className="font-bold text-sm"
                      style={{
                        fontFamily: activeThemeConfig.fontPairing.headingFamily,
                      }}
                    >
                      Signature Experience
                    </h5>
                    <span className="text-xs font-semibold text-stone-500 font-mono">
                      €65
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mb-3 leading-relaxed">
                    A demonstration of how cards render under the{" "}
                    {activeThemeConfig.name} style (
                    {activeThemeConfig.cardStyle} borders).
                  </p>
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-stone-100">
                    <span className="text-stone-400">45 minutes</span>
                    <span
                      className="font-semibold cursor-pointer"
                      style={{
                        color:
                          theme.primaryColor ||
                          activeThemeConfig.palette.primary,
                      }}
                    >
                      Select →
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Footer */}
              <div className="px-4 py-3 border-t border-stone-200/80 bg-stone-50/50 flex flex-wrap items-center justify-between text-[11px] text-stone-500 gap-2">
                <span>{footer.text || `© ${website.name}`}</span>
                <span>
                  {footer.address ||
                    footer.email ||
                    footer.phone ||
                    "All rights reserved."}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button className="button primary mt-6">Save website design</button>
      </form>
    </section>
  );
}

export function ModulesManagement({
  website,
  onSaved,
}: {
  website: ManagedWebsite;
  onSaved: (website: ManagedWebsite) => void;
}) {
  const modules = [
    {
      id: "cms",
      name: "Website pages",
      description: "Pages, navigation, content, and publishing.",
    },
    {
      id: "customers",
      name: "Customers",
      description: "Business-wide customer profiles and history.",
    },
    {
      id: "employees",
      name: "Employees",
      description: "Team profiles, assignments, and availability.",
    },
    {
      id: "agenda",
      name: "Agenda",
      description: "Calendar, reservations, and public booking.",
    },
  ];
  const toast = useToast();

  async function toggle(id: string) {
    try {
      const enabledModules = website.enabledModules.includes(id)
        ? website.enabledModules.filter((item) => item !== id)
        : [...website.enabledModules, id];
      const response = await httpClient.put<ManagedWebsite>(
        `/api/websites/${website.id}`,
        {
          ...website,
          enabledModules,
        },
      );
      toast.success("Module configuration updated.");
      onSaved(response.data);
    } catch {
      toast.error("Failed to update module settings.");
    }
  }

  return (
    <section>
      <PageHeader eyebrow="Website features" title="Modules" />
      <div className="module-settings">
        {modules.map((module) => (
          <article className="card module-setting" key={module.id}>
            <div>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
            </div>
            <button
              className={`switch ${website.enabledModules.includes(module.id) ? "on" : ""}`}
              onClick={() => void toggle(module.id)}
              aria-pressed={website.enabledModules.includes(module.id)}
            >
              <span />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
