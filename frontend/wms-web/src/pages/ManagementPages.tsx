import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { employeesApi, type EmployeeProfile } from '@modules/employees'
import { customersApi, type CustomerProfile } from '@modules/customers'
import { agendaApi, type Reservation } from '@modules/agenda'
import { cmsApi, type CatalogService } from '@modules/cms'
import { httpClient } from '@shared/api/httpClient'

function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>
}

export function EmployeesManagement({ websiteId }: { websiteId: string }) {
  const [items, setItems] = useState<EmployeeProfile[]>([])
  const [form, setForm] = useState({ displayName: '', email: '', roleTitle: 'Nail artist', bio: '' })
  const [error, setError] = useState('')
  async function load() { try { setItems((await employeesApi.list()).data) } catch { setError('Employees could not be loaded. Select a business first.') } }
  useEffect(() => { void load() }, [])
  async function create(event: FormEvent) {
    event.preventDefault()
    try { await employeesApi.create({ ...form, assignedWebsiteIds: [websiteId], skillTags: [], isActive: true }); setForm({ displayName: '', email: '', roleTitle: 'Nail artist', bio: '' }); await load() } catch { setError('Employee could not be created.') }
  }
  return <section><PageHeader eyebrow="People" title="Employees" action={<button className="button primary" onClick={() => document.getElementById('new-employee')?.scrollIntoView()}>＋ Add employee</button>} />{error && <p className="notice error">{error}</p>}<div className="management-grid"><div className="card-list">{items.map(item => <article className="card management-card" key={item.id}><div className="avatar">{item.displayName[0]}</div><div><h3>{item.displayName}</h3><p>{item.roleTitle} · {item.email}</p><small>{item.isActive ? 'Active' : 'Archived'}</small></div><button className="button small secondary" onClick={() => void employeesApi.updateSchedule(item.id, { weeklyWindows: [1, 2, 3, 4, 5].map(day => ({ day, startTime: '09:00', endTime: '17:00' })) }).then(() => setError(''))}>Set Mon–Fri 09:00–17:00</button><button className="button small secondary" onClick={() => void employeesApi.update(item.id, { ...item, isActive: !item.isActive }).then(load)}>{item.isActive ? 'Archive' : 'Restore'}</button></article>)}{items.length === 0 && <div className="empty-state"><h3>No employees yet</h3><p>Add your team so customers can choose who they book with.</p></div>}</div><form id="new-employee" className="builder-form" onSubmit={(event) => void create(event)}><h3>Add employee</h3><input required placeholder="Full name" value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} /><input required type="email" placeholder="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /><input placeholder="Role" value={form.roleTitle} onChange={event => setForm({ ...form, roleTitle: event.target.value })} /><textarea placeholder="Short bio" value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} /><button className="button primary">Add employee</button></form></div></section>
}

export function ServicesManagement() {
  const [items, setItems] = useState<CatalogService[]>([])
  const [form, setForm] = useState({ name: '', description: '', durationMinutes: 60, price: 0, currency: 'EUR', category: 'General', isActive: true })
  async function load() { setItems((await cmsApi.services()).data) }
  useEffect(() => { void load() }, [])
  async function create(event: FormEvent) { event.preventDefault(); await cmsApi.createService(form); setForm({ ...form, name: '', description: '' }); await load() }
  return <section><PageHeader eyebrow="Catalog" title="Services" action={<span className="status published">{items.filter(x => x.isActive).length} active</span>} /><div className="management-grid"><div className="card-list">{items.map(item => <article className="card management-card" key={item.id}><div><h3>{item.name}</h3><p>{item.durationMinutes} min · {item.price} {item.currency}</p><small>{item.description || 'No description'}</small></div><button className="button small secondary" onClick={() => void cmsApi.updateService(item.id, { isActive: !item.isActive }).then(load)}>{item.isActive ? 'Disable' : 'Enable'}</button></article>)}</div><form className="builder-form" onSubmit={(event) => void create(event)}><h3>Add service</h3><input required placeholder="Service name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><textarea placeholder="Description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /><div className="form-grid"><input type="number" min="5" step="5" value={form.durationMinutes} onChange={event => setForm({ ...form, durationMinutes: Number(event.target.value) })} /><input type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: Number(event.target.value) })} /></div><button className="button primary">Create service</button></form></div></section>
}

export function CustomersManagement({ websiteId: _websiteId }: { websiteId: string }) {
  const [items, setItems] = useState<CustomerProfile[]>([])
  const [search, setSearch] = useState('')
  async function load() { setItems((await customersApi.list(search)).data.items) }
  useEffect(() => { void load() }, [search])
  return <section><PageHeader eyebrow="Relationships" title="Customers" action={<input className="search-input" placeholder="Search customers" value={search} onChange={event => setSearch(event.target.value)} />} /><div className="table-card"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Websites visited</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{[item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unnamed customer'}</strong></td><td>{item.email}</td><td>{item.phone || '—'}</td><td>{item.visitedWebsiteIds.length}</td></tr>)}</tbody></table>{items.length === 0 && <div className="empty-state"><h3>No customers found</h3><p>Customers will appear here after they create an account or make a booking.</p></div>}</div></section>
}

export function AgendaManagement() {
  const [items, setItems] = useState<Reservation[]>([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  async function load() { const start = `${date}T00:00:00.000Z`; const end = `${date}T23:59:59.999Z`; setItems((await agendaApi.list({ from: start, to: end })).data) }
  useEffect(() => { void load() }, [date])
  return <section><PageHeader eyebrow="Operations" title="Agenda" action={<input type="date" value={date} onChange={event => setDate(event.target.value)} />} /><div className="agenda-board"><div className="agenda-summary"><strong>{items.length}</strong><span>bookings today</span></div>{items.map(item => <article className="agenda-row card" key={item.id}><div><strong>{new Date(item.startAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(item.endAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><p>{item.serviceSnapshot?.serviceName || 'Service'} · {item.clientSnapshot?.name || 'Customer'}</p></div><select value={item.status} onChange={event => void agendaApi.update(item.id, { status: event.target.value }).then(load)}><option>Pending</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select></article>)}{items.length === 0 && <div className="empty-state"><h3>Your calendar is clear</h3><p>Bookings made through your published websites will appear here.</p></div>}</div></section>
}

type ManagedWebsite = { id: string; name: string; domainOrSlug: string; category: string; enabledModules: string[]; themeConfig: { primaryColor?: string; logoUrl?: string; font?: string }; content?: { title?: string; tagline?: string; heroText?: string; navigation?: { brandLabel?: string; items?: { label: string; pageSlug: string }[]; showBookingButton?: boolean }; footer?: { text?: string; address?: string; email?: string; phone?: string } } }

export function ThemeManagement({ website, onSaved }: { website: ManagedWebsite; onSaved: (website: ManagedWebsite) => void }) {
  const [theme, setTheme] = useState(website.themeConfig ?? {})
  const [content, setContent] = useState(website.content ?? {})
  const [alias, setAlias] = useState(website.domainOrSlug)
  const [message, setMessage] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    try {
      const response = await httpClient.put<ManagedWebsite>(`/api/websites/${website.id}`, { ...website, domainOrSlug: alias, themeConfig: theme, content })
      setAlias(response.data.domainOrSlug)
      setMessage('Website settings saved.')
      onSaved(response.data)
    } catch { setMessage('Could not save website settings. Check the alias and try again.') }
  }
  const navigation = content.navigation ?? { brandLabel: content.title ?? website.name, items: [{ label: 'Home', pageSlug: 'home' }], showBookingButton: true }
  const footer = content.footer ?? { text: `© ${website.name}`, address: '', email: '', phone: '' }
  return <section><PageHeader eyebrow="Website design" title="Theme, navigation & footer" /><form className="builder-form wide-form" onSubmit={(event) => void save(event)}>{message && <p className="notice">{message}</p>}<h3>Website identity</h3><div className="form-grid"><label>Website alias<input required value={alias} onChange={event => setAlias(event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} /><small>Public URL: /sites/{alias || 'your-alias'}</small></label><label>Website title<input value={content.title ?? ''} onChange={event => setContent({ ...content, title: event.target.value })} /></label><label>Tagline<input value={content.tagline ?? ''} onChange={event => setContent({ ...content, tagline: event.target.value })} /></label><label>Hero message<textarea value={content.heroText ?? ''} onChange={event => setContent({ ...content, heroText: event.target.value })} /></label><label>Primary color<input type="color" value={theme.primaryColor ?? '#c26d8b'} onChange={event => setTheme({ ...theme, primaryColor: event.target.value })} /></label><label>Font<select value={theme.font ?? 'Inter'} onChange={event => setTheme({ ...theme, font: event.target.value })}><option>Inter</option><option>Georgia</option><option>DM Sans</option></select></label></div><h3>Navbar</h3><div className="form-grid"><label>Brand label<input value={navigation.brandLabel ?? ''} onChange={event => setContent({ ...content, navigation: { ...navigation, brandLabel: event.target.value } })} /></label><label>Navigation links<input value={(navigation.items ?? []).map(item => `${item.label}|${item.pageSlug}`).join(', ')} onChange={event => setContent({ ...content, navigation: { ...navigation, items: event.target.value.split(',').map(item => { const [label, pageSlug] = item.trim().split('|'); return { label: label?.trim() ?? '', pageSlug: pageSlug?.trim() ?? '' } }).filter(item => item.label && item.pageSlug) } })} /><small>Format: Home|home, About|about</small></label></div><label className="checkbox-row"><input type="checkbox" checked={navigation.showBookingButton ?? true} onChange={event => setContent({ ...content, navigation: { ...navigation, showBookingButton: event.target.checked } })} /> Show booking button</label><h3>Footer</h3><div className="form-grid"><label>Footer text<input value={footer.text ?? ''} onChange={event => setContent({ ...content, footer: { ...footer, text: event.target.value } })} /></label><label>Address<input value={footer.address ?? ''} onChange={event => setContent({ ...content, footer: { ...footer, address: event.target.value } })} /></label><label>Email<input value={footer.email ?? ''} onChange={event => setContent({ ...content, footer: { ...footer, email: event.target.value } })} /></label><label>Phone<input value={footer.phone ?? ''} onChange={event => setContent({ ...content, footer: { ...footer, phone: event.target.value } })} /></label></div><div className="theme-preview" style={{ background: theme.primaryColor ?? '#c26d8b' }}><span>Live preview</span><strong>{navigation.brandLabel || content.title || website.name}</strong><small>{content.tagline || 'Your website, your way.'}</small></div><button className="button primary">Save website design</button></form></section>
}

export function ModulesManagement({ website, onSaved }: { website: ManagedWebsite; onSaved: (website: ManagedWebsite) => void }) {
  const modules = [{ id: 'cms', name: 'Website pages', description: 'Pages, navigation, content, and publishing.' }, { id: 'customers', name: 'Customers', description: 'Business-wide customer profiles and history.' }, { id: 'employees', name: 'Employees', description: 'Team profiles, assignments, and availability.' }, { id: 'agenda', name: 'Agenda', description: 'Calendar, reservations, and public booking.' }]
  async function toggle(id: string) {
    const enabledModules = website.enabledModules.includes(id) ? website.enabledModules.filter(item => item !== id) : [...website.enabledModules, id]
    const response = await httpClient.put<ManagedWebsite>(`/api/websites/${website.id}`, { ...website, enabledModules })
    onSaved(response.data)
  }
  return <section><PageHeader eyebrow="Website features" title="Modules" /><div className="module-settings">{modules.map(module => <article className="card module-setting" key={module.id}><div><h3>{module.name}</h3><p>{module.description}</p></div><button className={`switch ${website.enabledModules.includes(module.id) ? 'on' : ''}`} onClick={() => void toggle(module.id)} aria-pressed={website.enabledModules.includes(module.id)}><span /></button></article>)}</div></section>
}
