import { useEffect, useState, type FormEvent } from 'react'
import { HeroSection, ServiceCatalogList, type CatalogService } from '@modules/cms'
import { NailistsShowcase, type EmployeeProfile } from '@modules/employees'
import { AgendaBookingWidget } from '@modules/agenda'
import { PasswordlessLoginModal } from '@modules/auth'
import { CustomerProfileDrawer } from '@modules/customers'
import { customersApi } from '@modules/customers'
import { employeesApi } from '@modules/employees'
import { agendaApi } from '@modules/agenda'
import { cmsApi } from '@modules/cms'
import { httpClient } from '@shared/api/httpClient'
import { useAuth } from '@shared/auth/AuthProvider'
import { useTenant } from './shared/tenancy/TenantProvider'

function AdminPortal() {
  const tenant = useTenant()
  const { user } = useAuth()
  const [tab, setTab] = useState('agenda')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [data, setData] = useState<unknown[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [businessId, setBusinessId] = useState(tenant?.businessId ?? '')
  const [message, setMessage] = useState('')
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string; websiteCount: number; isActive: boolean }>>([])
  useEffect(() => {
    void httpClient.get<Array<{ id: string; name: string; websiteCount: number; isActive: boolean }>>('/api/businesses')
      .then(({ data }) => setBusinesses(data))
  }, [])
  useEffect(() => { void loadTab() }, [tab])
  async function loadTab() {
    if (tab === 'customers') setData((await customersApi.list()).data.items)
    if (tab === 'employees') setData((await employeesApi.list()).data)
    if (tab === 'agenda') setData((await agendaApi.myReservations()).data)
    if (tab === 'cms') setData((await cmsApi.services()).data)
  }
  async function createEmployee(event: FormEvent) {
    event.preventDefault()
    const employee = await employeesApi.create({ email, displayName: name, assignedWebsiteIds: [], skillTags: [], isActive: true })
    await employeesApi.updateSchedule(employee.data.id, { windows: [] })
    setMessage('Employee created with a schedule ready to configure.')
    setName(''); setEmail('')
  }
  async function createService(event: FormEvent) {
    event.preventDefault()
    await cmsApi.createService({ name, durationMinutes: 60, price: 55, currency: 'EUR', isActive: true })
    setMessage('Service created.'); setName('')
  }
  async function createWebsite(event: FormEvent) {
    event.preventDefault()
    await httpClient.post(`/api/businesses/${businessId}/websites`, { name, domainOrSlug: domain, enabledModules: ['cms', 'employees', 'customers', 'agenda'] })
    setMessage('Website created.'); setName('')
  }
  async function createBusiness(event: FormEvent) {
    event.preventDefault()
    const response = await httpClient.post<{ id: string }>('/api/businesses', { name, ownerEmail: email })
    setBusinessId(response.data.id)
    localStorage.setItem('studio-tenant', JSON.stringify({ businessId: response.data.id, enabledModules: [] }))
    setMessage(`Business created: ${response.data.id}`)
    setName(''); setEmail('')
  }
  const setup = tab === 'setup'
  const visibleBusinesses = businesses.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
  return <main className="portal"><aside className={sidebarOpen ? 'sidebar' : 'sidebar collapsed'}><button onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation">☰</button>{sidebarOpen && <><h2>StudioPlatform</h2>{['setup', 'agenda', 'employees', 'customers', 'cms'].map((item) => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}</button>)}</>}</aside><div className="dashboard"><header><input aria-label="Search businesses" placeholder="Search businesses..." value={search} onChange={(event) => setSearch(event.target.value)} /><div><h1>Developer control panel</h1><p>Signed in as {user?.email}</p></div><label>Business<select value={businessId} onChange={(event) => setBusinessId(event.target.value)}><option value="">All businesses</option>{visibleBusinesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></header><section className="grid"><div className="card"><strong>{businesses.length}</strong><span>Total businesses</span></div><div className="card"><strong>{businesses.reduce((count, item) => count + item.websiteCount, 0)}</strong><span>Active websites</span></div><div className="card"><strong>Healthy</strong><span>MongoDB · Redis · API</span></div></section>{setup ? <section className="grid"><form className="card" onSubmit={(event) => void createBusiness(event)}><h2>Create business</h2><input required placeholder="Business name" value={name} onChange={(event) => setName(event.target.value)} /><input required type="email" placeholder="Owner email" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="submit">Create business</button></form><form className="card" onSubmit={(event) => void createWebsite(event)}><h2>Add website</h2><input required placeholder="Website name" value={name} onChange={(event) => setName(event.target.value)} /><input required placeholder="Domain or slug" value={domain} onChange={(event) => setDomain(event.target.value)} /><button type="submit" disabled={!businessId}>Create website</button></form><form className="card" onSubmit={(event) => void createEmployee(event)}><h2>Add nailist</h2><input required placeholder="Display name" value={name} onChange={(event) => setName(event.target.value)} /><input required type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="submit">Create nailist</button></form><form className="card" onSubmit={(event) => void createService(event)}><h2>Add service</h2><input required placeholder="Service name" value={name} onChange={(event) => setName(event.target.value)} /><button type="submit">Create service</button></form></section> : <section className="card"><h2>{tab[0].toUpperCase() + tab.slice(1)} workspace</h2><p>Live data for {businessId ? 'the selected business' : 'all businesses'}.</p><ul>{data.map((item, index) => <li key={index}>{JSON.stringify(item)}</li>)}</ul></section>}{message && <p role="status">{message}</p>}</div></main>
}

function PublicWebsite() {
  const { user, isAuthenticated, signOut } = useAuth()
  const [service, setService] = useState<CatalogService | null>(null)
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const tenant = useTenant()
  if (location.pathname === '/admin' && user?.roles.includes('Developer')) return <AdminPortal />
  if (location.pathname === '/admin') return <PasswordlessLoginModal scope="developer" onClose={() => location.assign('/')} />
  return <main className="portal"><header><h1>Glow Nail Studio</h1><p>{tenant?.enabledModules.join(' · ')}</p><button onClick={() => isAuthenticated ? signOut() : setLoginOpen(true)}>{isAuthenticated ? `Sign out (${user?.email})` : 'Sign in'}</button></header><HeroSection /><ServiceCatalogList onSelect={setService} /><NailistsShowcase onSelect={setEmployee} />{service && <AgendaBookingWidget selectedService={service} selectedResourceId={employee?.id} currentUser={user} onRequireAuth={() => setLoginOpen(true)} />}{isAuthenticated && <CustomerProfileDrawer />}{loginOpen && <PasswordlessLoginModal onClose={() => setLoginOpen(false)} />}</main>
}

export default PublicWebsite
