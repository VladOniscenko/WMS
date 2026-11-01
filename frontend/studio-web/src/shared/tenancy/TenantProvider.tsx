import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { httpClient } from '../api/httpClient'

export type Tenant = { businessId: string; websiteId: string; enabledModules: string[]; themeConfig?: { primaryColor?: string; logoUrl?: string; font?: string } }
const TenantContext = createContext<Tenant | null>(null)

export function TenantProvider({ children }: PropsWithChildren) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const slug = new URLSearchParams(location.search).get('site') ?? location.hostname
    httpClient.get(`/api/websites/resolve?slug=${encodeURIComponent(slug)}`).then(({ data }) => {
      const resolved: Tenant = { businessId: data.businessId, websiteId: data.websiteId, enabledModules: data.enabledModules, themeConfig: data.themeConfig }
      localStorage.setItem('studio-tenant', JSON.stringify(resolved))
      document.documentElement.style.setProperty('--theme-primary', data.themeConfig?.primaryColor ?? '#7c3aed')
      if (data.themeConfig?.font) document.documentElement.style.setProperty('--theme-font', data.themeConfig.font)
      setTenant(resolved)
    }).catch(() => setError('Unable to resolve this website. Please check the address and try again.'))
  }, [])
  if (error && location.pathname !== '/admin') return <p role="alert">{error}</p>
  if (error && location.pathname === '/admin') return <TenantContext.Provider value={null}>{children}</TenantContext.Provider>
  if (!tenant) return <p>Loading website…</p>
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
}
export const useTenant = () => useContext(TenantContext)
