import { httpClient } from '@shared/api/httpClient'
export { HeroSection, ServiceCatalogList } from './components'
export type CmsPageSection = { id: string; pageKey: string; sectionKey: string; contentJson: string; order: number }
export type CatalogService = { id: string; name: string; description?: string; durationMinutes: number; price: number; currency: string; category?: string; isActive: boolean }
export const cmsApi = {
  page: (pageKey: string) => httpClient.get<CmsPageSection[]>(`/api/cms/pages/${pageKey}`),
  savePage: (pageKey: string, sections: CmsPageSection[]) => httpClient.put(`/api/cms/pages/${pageKey}`, sections),
  services: () => httpClient.get<CatalogService[]>('/api/catalog/services'),
  createService: (service: Omit<CatalogService, 'id'>) => httpClient.post<CatalogService>('/api/catalog/services', service),
  updateService: (id: string, service: Partial<CatalogService>) => httpClient.put<CatalogService>(`/api/catalog/services/${id}`, service),
  deleteService: (id: string) => httpClient.delete(`/api/catalog/services/${id}`),
}
