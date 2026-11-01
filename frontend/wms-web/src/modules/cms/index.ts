import { httpClient } from '@shared/api/httpClient'
export { ServiceCatalogList } from './components'
export { PublicPageRenderer } from './PublicPageRenderer'
export { CanvasPageEditor } from './CanvasPageEditor'
export type { WebsitePage, PageSection } from '@shared/queries/useWebsites'

export type CatalogService = {
  id: string
  websiteId?: string
  name: string
  description?: string
  durationMinutes: number
  price: number
  currency: string
  category?: string
  imageUrl?: string
  isActive: boolean
}

export const catalogApi = {
  list: (websiteId?: string) =>
    httpClient.get<CatalogService[]>('/api/catalog/services', {
      params: websiteId ? { websiteId } : undefined,
    }),
  create: (service: Omit<CatalogService, 'id'> & { websiteId?: string }) =>
    httpClient.post<CatalogService>('/api/catalog/services', service),
  update: (id: string, service: Partial<CatalogService>) =>
    httpClient.put<CatalogService>(`/api/catalog/services/${id}`, service),
  delete: (id: string) => httpClient.delete(`/api/catalog/services/${id}`),
}

export const cmsApi = {
  services: (websiteId?: string) => catalogApi.list(websiteId),
  createService: (service: Omit<CatalogService, 'id'> & { websiteId?: string }) => catalogApi.create(service),
  updateService: (id: string, service: Partial<CatalogService>) => catalogApi.update(id, service),
  deleteService: (id: string) => catalogApi.delete(id),
}
