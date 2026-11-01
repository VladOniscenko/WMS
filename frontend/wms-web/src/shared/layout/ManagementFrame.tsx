import { NavLink, Outlet } from 'react-router-dom'
import {
  Layers,
  FileText,
  Palette,
  Boxes,
  Scissors,
  Users,
  UserCheck,
  Calendar,
  ArrowLeft,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@shared/auth/AuthProvider'
import { WorkspaceSearch } from '@shared/ui/CommandPalette'
import type { Website } from '@shared/queries'

interface NavItemConfig {
  label: string
  path: string
  icon: LucideIcon
}

interface ManagementFrameProps {
  website: Website
  onBack: () => void
}

export function ManagementFrame({ website, onBack }: ManagementFrameProps) {
  const { user, signOut } = useAuth()
  const base = `/manage/websites/${website.id}`

  const navItems: NavItemConfig[] = [
    { label: 'Overview', path: `${base}/overview`, icon: Layers },
    { label: 'Pages', path: `${base}/pages`, icon: FileText },
    { label: 'Theme & navigation', path: `${base}/theme`, icon: Palette },
    { label: 'Modules', path: `${base}/modules`, icon: Boxes },
    { label: 'Services', path: `${base}/services`, icon: Scissors },
    { label: 'Customers', path: `${base}/customers`, icon: Users },
    { label: 'Employees', path: `${base}/employees`, icon: UserCheck },
    { label: 'Agenda', path: `${base}/agenda`, icon: Calendar },
  ]

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span>WMS</span>
        </div>

        <p className="eyebrow">Website</p>
        <div className="site-switcher">
          <strong>{website.name}</strong>
          <small>/{website.domainOrSlug}</small>
        </div>

        <nav aria-label="Website sections">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={label}
              to={path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-4 h-4 shrink-0 transition-colors" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="nav-item inline-flex items-center gap-2 cursor-pointer"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>All websites</span>
          </button>
          <a
            className="nav-item inline-flex items-center gap-2"
            href={`/sites/${website.domainOrSlug}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>Visit website</span>
          </a>
          <button type="button" className="profile-chip" onClick={signOut}>
            <span className="avatar">{user?.email?.[0].toUpperCase()}</span>
            <span>{user?.email}</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{website.category}</p>
            <h1>{website.name}</h1>
          </div>
          <div className="top-actions">
            <WorkspaceSearch website={website} />
            <button className="button secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <div className="workspace-content">
          <Outlet />
        </div>
      </section>
    </main>
  )
}

