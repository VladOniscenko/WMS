import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { AgendaBookingWidget } from '@modules/agenda'
import { PasswordlessLoginModal } from '@modules/auth'
import { CustomerProfileDrawer } from '@modules/customers'
import { NailistsShowcase, type EmployeeProfile } from '@modules/employees'
import { ServiceCatalogList, type CatalogService } from '@modules/cms'
import { CanvasPageEditor } from '@modules/cms/CanvasPageEditor'
import { PublicPageRenderer } from '@modules/cms/PublicPageRenderer'
import { AgendaManagement, CustomersManagement, EmployeesManagement, ModulesManagement, ServicesManagement, ThemeManagement } from './pages/ManagementPages'
import { httpClient } from '@shared/api/httpClient'
import { useAuth } from '@shared/auth/AuthProvider'
import { useTenant } from './shared/tenancy/TenantProvider'

type Business = { id: string; name: string; ownerEmail: string; websiteCount: number; websites: Website[] }
type Website = { id: string; businessId: string; name: string; domainOrSlug: string; category: string; status: string; enabledModules: string[]; themeConfig: { primaryColor?: string; logoUrl?: string; font?: string }; content?: { title?: string; tagline?: string; heroText?: string; navigation?: { brandLabel?: string; items?: { label: string; pageSlug: string }[]; showBookingButton?: boolean }; footer?: { text?: string; address?: string; email?: string; phone?: string } } }
type PageSection = { id: string; type: string; heading: string; body?: string; imageUrl?: string; sortOrder: number }
type WebsitePage = { id: string; websiteId: string; slug: string; title: string; status: string; showInNavigation: boolean; sections: PageSection[] }

function ManagementFrame({ children, onBack, website }: { children: ReactNode; onBack: () => void; website: Website }) {
  const { user, signOut } = useAuth()
  const base = `/manage/websites/${website.id}`
  return <main className="app-shell"><aside className="app-sidebar"><div className="brand"><span className="brand-mark">W</span><span>WMS</span></div><p className="eyebrow">Website</p><div className="site-switcher"><strong>{website.name}</strong><small>/{website.domainOrSlug}</small></div><nav>{[['Pages', `${base}/pages`], ['Theme & navigation', `${base}/theme`], ['Modules', `${base}/modules`], ['Services', `${base}/services`], ['Customers', `${base}/customers`], ['Employees', `${base}/employees`], ['Agenda', `${base}/agenda`]].map(([label, path]) => <button key={label} className="nav-item" onClick={() => navigate(path)}>{label}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={onBack}>← All websites</button><a className="nav-item" href={`/sites/${website.domainOrSlug}`} target="_blank" rel="noreferrer">Visit website ↗</a><button className="profile-chip" onClick={signOut}><span className="avatar">{user?.email?.[0].toUpperCase()}</span><span>{user?.email}</span></button></div></aside><section className="workspace"><header className="topbar"><div><p className="eyebrow">{website.category}</p><h1>{website.name}</h1></div><button className="button secondary" onClick={signOut}>Sign out</button></header><div className="workspace-content">{children}</div></section></main>
}

const templates = [
  { id: 'editorial', name: 'Editorial Studio', description: 'Bold typography and an elegant editorial layout.', color: '#b77962' },
  { id: 'minimal', name: 'Minimal Atelier', description: 'Quiet, refined, and focused on your services.', color: '#9b8b7a' },
  { id: 'playful', name: 'Playful Pop', description: 'Bright, expressive, and made for modern brands.', color: '#c26d8b' },
]

function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function ProfileOnboarding({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', line1: '', city: '', postalCode: '', country: '' })
  async function submit(event: FormEvent) {
    event.preventDefault()
    await httpClient.put('/api/onboarding/profile', { firstName: form.firstName, lastName: form.lastName, phone: form.phone, address: { line1: form.line1, city: form.city, postalCode: form.postalCode, country: form.country } })
    onComplete()
  }
  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value })
  return <section className="card onboarding"><h1>Tell us about you</h1><p>Complete your profile before creating a business.</p><form onSubmit={(event) => void submit(event)}>{(['firstName', 'lastName', 'phone', 'line1', 'city', 'postalCode', 'country'] as const).map((key) => <input key={key} required={key === 'firstName' || key === 'lastName'} placeholder={key} value={form[key]} onChange={update(key)} />)}<button type="submit">Continue</button></form></section>
}

function WmsManager() {
  const { user, signOut } = useAuth()
  const [profileReady, setProfileReady] = useState<boolean | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState('')
  const [message, setMessage] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [website, setWebsite] = useState({ name: '', slug: '', category: 'Nail studio', color: '#c26d8b', heroText: '' })
  const [modules, setModules] = useState(['cms', 'customers', 'employees', 'agenda'])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteWebsite, setInviteWebsite] = useState('')
  const [route, setRoute] = useState(location.pathname)
  const [template, setTemplate] = useState(templates[0].id)
  const [pages, setPages] = useState<WebsitePage[]>([])
  const [pageDraft, setPageDraft] = useState({ title: '', slug: 'home', status: 'Draft' })
  const [sectionType, setSectionType] = useState('text')
  const [sectionHeading, setSectionHeading] = useState('')
  const [sectionBody, setSectionBody] = useState('')

  useEffect(() => {
    const onPop = () => setRoute(location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    const activeWebsite = businesses.flatMap(item => item.websites).find(item => item.id === inviteWebsite)
    if (selectedBusiness) localStorage.setItem('studio-tenant', JSON.stringify({ businessId: selectedBusiness, websiteId: activeWebsite?.id ?? inviteWebsite ?? '' }))
  }, [selectedBusiness, inviteWebsite, businesses])

  async function load() {
    if (user?.roles.includes('Developer')) setProfileReady(true)
    else {
      try {
        await httpClient.get('/api/onboarding/profile')
        setProfileReady(true)
      } catch { setProfileReady(false) }
    }
    const response = await httpClient.get<Business[]>('/api/businesses')
    setBusinesses(response.data)
    if (!selectedBusiness && response.data[0]) setSelectedBusiness(response.data[0].id)
    if (!inviteWebsite && response.data[0]?.websites[0]) setInviteWebsite(response.data[0].websites[0].id)
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const match = route.match(/^\/manage\/websites\/([^/]+)/)
    if (match) {
      setInviteWebsite(match[1])
      if (route.includes('/pages')) void loadPages(match[1])
    }
  }, [route])
  if (profileReady === null) return <p>Loading your WMS workspace…</p>
  if (!profileReady) return <ProfileOnboarding onComplete={() => void load()} />
  async function createBusiness(event: FormEvent) {
    event.preventDefault()
    const result = await httpClient.post<Business>('/api/businesses', { name: businessName, ownerEmail: user?.email })
    setBusinesses([...businesses, result.data]); setSelectedBusiness(result.data.id); setBusinessName(''); setMessage('Business created.')
  }
  async function createWebsite(event: FormEvent) {
    event.preventDefault()
    const result = await httpClient.post<Website>(`/api/businesses/${selectedBusiness}/websites`, {
      name: website.name, domainOrSlug: website.slug, templateId: template, category: website.category, enabledModules: modules,
      themeConfig: { primaryColor: website.color }, content: { title: website.name, heroText: website.heroText },
    })
    setBusinesses(businesses.map((item) => item.id === selectedBusiness ? { ...item, websites: [...item.websites, result.data], websiteCount: item.websiteCount + 1 } : item))
    setWebsite({ name: '', slug: '', category: 'Nail studio', color: '#c26d8b', heroText: '' }); setMessage('Website saved as a draft.')
  }
  async function publish(id: string) { await httpClient.post(`/api/websites/${id}/publish`); await load(); setMessage('Website published.'); }
  async function loadPages(websiteId: string) {
    const response = await httpClient.get<WebsitePage[]>(`/api/websites/${websiteId}/pages`)
    setPages(response.data)
  }
  async function createPage(event: FormEvent) {
    event.preventDefault()
    if (!selectedBusiness || !inviteWebsite) return
    const response = await httpClient.post<WebsitePage>(`/api/websites/${inviteWebsite}/pages`, {
      ...pageDraft, sections: [], showInNavigation: true,
    })
    setPages([...pages, response.data])
    setPageDraft({ title: '', slug: 'home', status: 'Draft' })
    setMessage('Page created.')
  }
  async function savePage(page: WebsitePage) {
    await httpClient.put(`/api/websites/${page.websiteId}/pages/${page.id}`, page)
    setMessage('Page saved.')
  }
  function addSection(page: WebsitePage) {
    const next = { id: crypto.randomUUID(), type: sectionType, heading: sectionHeading || 'New section', body: sectionBody, sortOrder: page.sections.length }
    const updated = { ...page, sections: [...page.sections, next] }
    setPages(pages.map(item => item.id === page.id ? updated : item))
    setSectionHeading(''); setSectionBody('')
  }
  async function invite(event: FormEvent) {
    event.preventDefault()
    await httpClient.post(`/api/websites/${inviteWebsite}/invitations`, { email: inviteEmail, role: 'Editor' })
    setInviteEmail(''); setMessage('Invitation created.')
  }
  const activeWebsite = businesses.flatMap(item => item.websites).find(item => item.id === inviteWebsite)
  const section = route.split('/').filter(Boolean).at(-1)
  const isPages = route.includes('/pages')
  if (isPages && activeWebsite) return <CanvasPageEditor websiteId={activeWebsite.id} websiteName={activeWebsite.name} onBack={() => navigate('/manage/websites')} />
  if (route.endsWith('/employees') && activeWebsite) return <ManagementFrame website={activeWebsite} onBack={() => navigate('/manage/websites')}><EmployeesManagement /></ManagementFrame>
  if (route.endsWith('/services') && activeWebsite) return <ManagementFrame website={activeWebsite} onBack={() => navigate('/manage/websites')}><ServicesManagement /></ManagementFrame>
  if (route.endsWith('/customers') && activeWebsite) return <ManagementFrame website={activeWebsite} onBack={() => navigate('/manage/websites')}><CustomersManagement /></ManagementFrame>
  if (route.endsWith('/agenda') && activeWebsite) return <ManagementFrame website={activeWebsite} onBack={() => navigate('/manage/websites')}><AgendaManagement /></ManagementFrame>
  if (route.endsWith('/theme') && activeWebsite) return <ManagementFrame website={activeWebsite} onBack={() => navigate('/manage/websites')}><ThemeManagement website={activeWebsite} onSaved={() => void load()} /></ManagementFrame>
  if (route.endsWith('/modules') && activeWebsite) return <ManagementFrame website={activeWebsite} onBack={() => navigate('/manage/websites')}><ModulesManagement website={activeWebsite} onSaved={() => void load()} /></ManagementFrame>
  return <main className="app-shell"><aside className="app-sidebar"><div className="brand"><span className="brand-mark">W</span><span>WMS</span></div><p className="eyebrow">Account</p><select className="switcher" value={selectedBusiness} onChange={(event) => setSelectedBusiness(event.target.value)}><option value="">Choose business</option>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><nav>{[['Overview', `/manage`], ['Websites', '/manage/websites']].map(([label, path]) => <button key={label} className={route === path ? 'nav-item active' : 'nav-item'} onClick={() => navigate(path)}>{label}</button>)}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={() => navigate('/manage/settings')}>Account settings</button><button className="profile-chip" onClick={signOut}><span className="avatar">{user?.email?.[0].toUpperCase()}</span><span>{user?.email}</span></button></div></aside><section className="workspace"><header className="topbar"><div><p className="eyebrow">Business workspace</p><h1>{section === 'pages' ? 'Pages & content' : section === 'websites' ? 'Your websites' : 'Good to see you again'}</h1></div><div className="top-actions"><button className="icon-button">⌕</button><button className="button secondary" onClick={signOut}>Sign out</button></div></header><div className="workspace-content">{route === '/manage' && <><section className="welcome-panel"><div><p className="eyebrow">Your digital studio</p><h2>Build beautiful websites, without the busywork.</h2><p>Create, customize, and publish every website your businesses need from one calm workspace.</p><button className="button primary" onClick={() => navigate('/manage/websites/new')}>Create a website <span>→</span></button></div><div className="welcome-orb">✦</div></section><div className="stat-grid"><div className="stat-card"><span>Businesses</span><strong>{businesses.length}</strong></div><div className="stat-card"><span>Websites</span><strong>{businesses.reduce((count, item) => count + item.websiteCount, 0)}</strong></div><div className="stat-card"><span>Published</span><strong>{businesses.flatMap(item => item.websites).filter(item => item.status === 'Published').length}</strong></div></div></>}{route === '/manage/settings' && <section><div className="section-heading"><div><p className="eyebrow">Workspace settings</p><h2>Businesses & access</h2></div></div><div className="editor-layout"><form className="builder-form" onSubmit={(event) => void createBusiness(event)}><h3>Create a business</h3><p className="muted">Create another business under your account.</p><input required placeholder="Business name" value={businessName} onChange={event => setBusinessName(event.target.value)} /><button className="button primary">Create business</button></form><form className="builder-form" onSubmit={(event) => void invite(event)}><h3>Invite collaborator</h3><select required value={inviteWebsite} onChange={event => setInviteWebsite(event.target.value)}><option value="">Choose website</option>{businesses.flatMap(item => item.websites).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input required type="email" placeholder="Email address" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} /><button className="button primary">Send invitation</button></form></div></section>}{route === '/manage/websites' && <section><div className="section-heading"><div><p className="eyebrow">Manage your presence</p><h2>Websites</h2></div><button className="button primary" onClick={() => navigate('/manage/websites/new')}>＋ New website</button></div><div className="website-grid">{businesses.flatMap(item => item.websites).map(item => <article className="website-card" key={item.id}><div className="website-preview" style={{ background: item.status === 'Published' ? '#e7d8d0' : '#eceaf0' }}><span>{item.category}</span><strong>{item.name}</strong></div><div className="website-card-body"><div><h3>{item.name}</h3><p>/{item.domainOrSlug} · <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></p></div><button className="button small secondary" onClick={() => { setInviteWebsite(item.id); navigate(`/manage/websites/${item.id}/pages`); }}>Edit</button></div></article>)}</div></section>}{route === '/manage/websites/new' && <section><div className="section-heading"><div><p className="eyebrow">Start with a foundation</p><h2>Choose a template</h2></div><button className="button secondary" onClick={() => navigate('/manage/websites')}>Cancel</button></div><div className="template-grid">{templates.map(item => <button key={item.id} className={`template-card ${template === item.id ? 'chosen' : ''}`} onClick={() => setTemplate(item.id)}><div className="template-art" style={{ background: item.color }}><span>✦</span><strong>{item.name}</strong></div><h3>{item.name}</h3><p>{item.description}</p></button>)}</div><form className="builder-form" onSubmit={(event) => { void createWebsite(event); navigate('/manage/websites') }}><h3>Website details</h3><div className="form-grid"><input required placeholder="Website name" value={website.name} onChange={(event) => setWebsite({ ...website, name: event.target.value })} /><input required placeholder="WMS slug" value={website.slug} onChange={(event) => setWebsite({ ...website, slug: event.target.value.toLowerCase().replace(/\\s+/g, '-') })} /><input placeholder="Category" value={website.category} onChange={(event) => setWebsite({ ...website, category: event.target.value })} /><input placeholder="Hero text" value={website.heroText} onChange={(event) => setWebsite({ ...website, heroText: event.target.value })} /></div><label className="color-field">Brand color <input type="color" value={website.color} onChange={(event) => setWebsite({ ...website, color: event.target.value })} /></label><fieldset><legend>Website modules</legend><div className="module-options">{['cms', 'customers', 'employees', 'agenda'].map(module => <label key={module}><input type="checkbox" checked={modules.includes(module)} onChange={() => setModules(modules.includes(module) ? modules.filter(item => item !== module) : [...modules, module])} /> <span>{module}</span></label>)}</div></fieldset><button className="button primary" disabled={!selectedBusiness}>Create draft website</button></form></section>}{isPages && activeWebsite && <section><div className="section-heading"><div><p className="eyebrow">{activeWebsite.name}</p><h2>Pages & content</h2></div><div className="top-actions"><button className="button secondary" onClick={() => void publish(activeWebsite.id)}>Publish website</button><button className="button primary" onClick={() => { setPageDraft({ title: 'New page', slug: 'new-page', status: 'Draft' }); void createPage({ preventDefault: () => undefined } as FormEvent) }}>＋ Add page</button></div></div><div className="editor-layout"><aside className="page-list"><h3>Pages</h3>{pages.map(page => <button key={page.id} className="page-row"><span>{page.title}</span><small>{page.status}</small></button>)}{pages.length === 0 && <p className="muted">No pages yet. Start with Home.</p>}</aside><div className="page-editor"><form className="builder-form" onSubmit={(event) => void createPage(event)}><h3>Page settings</h3><div className="form-grid"><input placeholder="Page title" value={pageDraft.title} onChange={event => setPageDraft({ ...pageDraft, title: event.target.value })} /><input placeholder="Page slug" value={pageDraft.slug} onChange={event => setPageDraft({ ...pageDraft, slug: event.target.value })} /></div><button className="button secondary">Save new page</button></form>{pages.map(page => <article className="section-editor" key={page.id}><div className="section-heading"><div><h3>{page.title}</h3><p className="muted">{page.sections.length} sections</p></div><button className="button secondary" onClick={() => void savePage({ ...page, status: page.status === 'Published' ? 'Draft' : 'Published' })}>{page.status === 'Published' ? 'Unpublish' : 'Publish page'}</button></div>{page.sections.map(item => <div className="section-row" key={item.id}><span className="drag-handle">⠿</span><div><strong>{item.heading}</strong><p>{item.body}</p></div><button className="icon-button">⋯</button></div>)}<div className="add-section"><select value={sectionType} onChange={event => setSectionType(event.target.value)}><option value="hero">Hero</option><option value="text">Text</option><option value="image">Image</option><option value="gallery">Gallery</option><option value="services">Services</option><option value="nailists">Nailists</option><option value="booking">Booking</option><option value="contact">Contact</option></select><input placeholder="Section heading" value={sectionHeading} onChange={event => setSectionHeading(event.target.value)} /><input placeholder="Content" value={sectionBody} onChange={event => setSectionBody(event.target.value)} /><button className="button small primary" onClick={() => addSection(page)}>Add section</button></div></article>)}</div></div></section>}{message && <div className="toast" role="status">{message}</div>}</div></section></main>
}

function PublicWebsite() {
  const tenant = useTenant()
  const { user, isAuthenticated, signOut } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [service, setService] = useState<CatalogService | null>(null)
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null)
  const parts = location.pathname.split('/').filter(Boolean)
  const slug = parts[0] === 'sites' ? parts[1] : new URLSearchParams(location.search).get('site') ?? ''
  const pageSlug = parts[2] ?? 'home'
  return <main className="public-site"><header className="public-header"><div><p className="eyebrow">WMS website</p><h1>{tenant?.content?.title || 'Your website'}</h1></div><nav><a href={`/sites/${slug}`}>Home</a><a href={`/sites/${slug}/about`}>About</a><button className="button secondary" onClick={() => isAuthenticated ? signOut() : setLoginOpen(true)}>{isAuthenticated ? 'Sign out' : 'Sign in'}</button></nav></header><PublicPageRenderer slug={slug} pageSlug={pageSlug} /><div className="public-modules">{tenant?.enabledModules.includes('cms') && <ServiceCatalogList onSelect={setService} />}{tenant?.enabledModules.includes('employees') && <NailistsShowcase onSelect={setEmployee} />}</div>{service && tenant?.enabledModules.includes('agenda') && <AgendaBookingWidget selectedService={service} selectedResourceId={employee?.id} currentUser={user} onRequireAuth={() => setLoginOpen(true)} />}{isAuthenticated && tenant?.enabledModules.includes('customers') && <CustomerProfileDrawer />}{loginOpen && <PasswordlessLoginModal onClose={() => setLoginOpen(false)} />}</main>
}

export default function App() {
  const { user } = useAuth()
  if (location.pathname.startsWith('/manage') || location.pathname === '/admin') return user ? <WmsManager /> : <PasswordlessLoginModal scope={location.pathname === '/admin' ? 'developer' : 'customer'} onClose={() => undefined} />
  return <PublicWebsite />
}
