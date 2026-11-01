import { httpClient } from '@shared/api/httpClient'
export { CustomerProfileDrawer } from './components'
export type CustomerProfile = { id: string; email: string; firstName?: string; lastName?: string; phone?: string; notes?: string; consentMarketing: boolean; visitedWebsiteIds: string[] }
export const customersApi = {
  me: () => httpClient.get<CustomerProfile>('/api/customers/me'),
  updateMe: (profile: Partial<CustomerProfile>) => httpClient.put<CustomerProfile>('/api/customers/me', profile),
  list: (search = '', page = 1, pageSize = 25) => httpClient.get<{ items: CustomerProfile[]; total: number }>('/api/customers', { params: { search, page, pageSize } }),
  get: (id: string) => httpClient.get<CustomerProfile>(`/api/customers/${id}`),
}
