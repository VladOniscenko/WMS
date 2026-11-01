import { httpClient } from '@shared/api/httpClient'
export { AgendaBookingWidget } from './components'
export type Slot = { startTimeUtc: string; endTimeUtc: string; resourceId: string }
export type Reservation = { id: string; resourceId: string; clientId: string; startAtUtc: string; endAtUtc: string; status: string; serviceSnapshot?: { serviceName?: string }; clientSnapshot?: { name?: string } }
export const agendaApi = {
  slots: (resourceId: string, date: string, durationMinutes: number) => httpClient.get<Slot[]>('/api/agenda/slots', { params: { resourceId, date, durationMinutes } }),
  book: (reservation: Omit<Reservation, 'id'>) => httpClient.post<Reservation>('/api/agenda/reservations', reservation),
  myReservations: () => httpClient.get<Reservation[]>('/api/agenda/reservations/my'),
  list: (params: { from?: string; to?: string; resourceId?: string }) => httpClient.get<Reservation[]>('/api/agenda/reservations', { params }),
  update: (id: string, patch: { status: string }) => patch.status === 'Cancelled'
    ? httpClient.patch<Reservation>(`/api/agenda/reservations/${id}/cancel`)
    : httpClient.patch<Reservation>(`/api/agenda/reservations/${id}`, patch),
  cancel: (id: string) => httpClient.patch(`/api/agenda/reservations/${id}/cancel`),
}
