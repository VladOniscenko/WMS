import { httpClient } from '@shared/api/httpClient'
export { NailistsShowcase, NailistPicker } from './components'
export type EmployeeProfile = { id: string; assignedWebsiteIds: string[]; email: string; displayName: string; roleTitle?: string; bio?: string; avatarUrl?: string; colorHex?: string; skillTags: string[]; isActive: boolean }
export const employeesApi = {
  public: () => httpClient.get<EmployeeProfile[]>('/api/employees/public'),
  list: () => httpClient.get<EmployeeProfile[]>('/api/employees'),
  create: (employee: Omit<EmployeeProfile, 'id'>) => httpClient.post<EmployeeProfile>('/api/employees', employee),
  update: (id: string, employee: Partial<EmployeeProfile>) => httpClient.put<EmployeeProfile>(`/api/employees/${id}`, employee),
  updateSchedule: (id: string, schedule: unknown) => httpClient.put(`/api/employees/${id}/schedule`, schedule),
}
