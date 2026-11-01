import { httpClient } from '@shared/api/httpClient'
export { AgendaBookingWidget } from './components'
export { AgendaManagement } from './AgendaManagement'
export type Slot = { startTimeUtc: string; endTimeUtc: string; resourceId: string }
export type Reservation = {
  id: string
  resourceId: string
  clientId: string
  startAtUtc: string
  endAtUtc: string
  status: string
  notes?: string
  serviceSnapshot?: { serviceName?: string; price?: number; durationMinutes?: number }
  clientSnapshot?: { name?: string; email?: string; phone?: string }
}
export const agendaApi = {
  slots: (
    resourceId?: string,
    date?: string,
    durationMinutes?: number,
    slug?: string,
    tenantHeaders?: { businessId?: string; websiteId?: string },
  ) => {
    const params: Record<string, string | number> = {}
    if (resourceId) params.resourceId = resourceId
    if (date) params.date = date
    if (durationMinutes) params.durationMinutes = durationMinutes
    if (slug) params.slug = slug

    const headers: Record<string, string> = {}
    if (tenantHeaders?.businessId) headers['X-Business-Id'] = tenantHeaders.businessId
    if (tenantHeaders?.websiteId) headers['X-Website-Id'] = tenantHeaders.websiteId

    return httpClient.get<Slot[]>('/api/agenda/slots', {
      params,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    })
  },
  book: (reservation: Omit<Reservation, 'id'>) => httpClient.post<Reservation>('/api/agenda/reservations', reservation),
  myReservations: () => httpClient.get<Reservation[]>('/api/agenda/reservations/my'),
  list: (params: { from?: string; to?: string; resourceId?: string }) => httpClient.get<Reservation[]>('/api/agenda/reservations', { params }),
  update: (
    id: string,
    patch: {
      status?: string
      startAtUtc?: string
      endAtUtc?: string
      resourceId?: string
      notes?: string
    },
  ) =>
    patch.status === 'Cancelled'
      ? httpClient.patch<Reservation>(`/api/agenda/reservations/${id}/cancel`)
      : httpClient.patch<Reservation>(`/api/agenda/reservations/${id}`, patch),
  cancel: (id: string) => httpClient.patch<Reservation>(`/api/agenda/reservations/${id}/cancel`),
}

