import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agendaApi, type Reservation } from '@modules/agenda'

export const reservationKeys = {
  all: ['reservations'] as const,
  byRange: (from?: string, to?: string) => ['reservations', { from, to }] as const,
  my: ['reservations', 'my'] as const,
}

export function useReservations(date?: string) {
  const from = date ? `${date}T00:00:00.000Z` : undefined
  const to = date ? `${date}T23:59:59.999Z` : undefined

  return useQuery({
    queryKey: reservationKeys.byRange(from, to),
    queryFn: async () => {
      const { data } = await agendaApi.list({ from, to })
      return data
    },
  })
}

export function useMyReservations() {
  return useQuery({
    queryKey: reservationKeys.my,
    queryFn: async () => {
      const { data } = await agendaApi.myReservations()
      return data
    },
  })
}

export function useUpdateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await agendaApi.update(id, { status })
      return response.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reservationKeys.all })
    },
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reservation: Omit<Reservation, 'id'>) => {
      const { data } = await agendaApi.book(reservation)
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reservationKeys.all })
    },
  })
}

