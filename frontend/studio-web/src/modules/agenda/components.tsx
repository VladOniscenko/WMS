import { useEffect, useState } from 'react'
import { agendaApi, type Reservation, type Slot } from './index'
type CatalogService = { id: string; name: string; durationMinutes: number; price: number; currency: string }
type AuthUser = { id: string; email: string; roles: string[] }

type Props = { selectedService: CatalogService; selectedResourceId?: string; currentUser: AuthUser | null; onRequireAuth: () => void }
export function AgendaBookingWidget({ selectedService, selectedResourceId, currentUser, onRequireAuth }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<Slot[]>([])
  const [selected, setSelected] = useState<Slot | null>(null)
  const [confirmation, setConfirmation] = useState<Reservation | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  useEffect(() => {
    if (!selectedResourceId) return
    void agendaApi.slots(selectedResourceId, date, selectedService.durationMinutes).then(({ data }) => setSlots(data))
  }, [date, selectedResourceId, selectedService.durationMinutes])
  async function book() {
    if (!currentUser) { onRequireAuth(); return }
    if (!selected || !selectedResourceId) return
    const { data } = await agendaApi.book({ resourceId: selectedResourceId, clientId: currentUser.id, startAtUtc: selected.startTimeUtc, endAtUtc: selected.endTimeUtc, status: 'Pending' })
    setConfirmation(data)
    const mine = await agendaApi.myReservations()
    setReservations(mine.data)
  }
  return <section><h2>Book {selectedService.name}</h2><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>{!selectedResourceId && <p>Select a nail artist first.</p>}<div className="slots">{slots.map((slot) => <button className={selected?.startTimeUtc === slot.startTimeUtc ? 'selected' : ''} key={slot.startTimeUtc} onClick={() => setSelected(slot)}>{new Date(slot.startTimeUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</button>)}</div><button disabled={!selected} onClick={() => void book()}>Reserve Spot</button>{confirmation && <p role="status">Booking confirmed for {new Date(confirmation.startAtUtc).toLocaleString()}.</p>}{currentUser && reservations.length > 0 && <><h3>My Reservations</h3><ul>{reservations.map((item) => <li key={item.id}>{new Date(item.startAtUtc).toLocaleString()} · {item.status}</li>)}</ul></>}</section>
}
