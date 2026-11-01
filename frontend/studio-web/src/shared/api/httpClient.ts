import axios from 'axios'

export const httpClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000' })

httpClient.interceptors.request.use((config) => {
  const tenant = JSON.parse(localStorage.getItem('studio-tenant') ?? '{}') as { businessId?: string; websiteId?: string }
  if (tenant.businessId) config.headers.set('X-Business-Id', tenant.businessId)
  if (tenant.websiteId) config.headers.set('X-Website-Id', tenant.websiteId)
  const token = localStorage.getItem('studio-access-token')
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})
