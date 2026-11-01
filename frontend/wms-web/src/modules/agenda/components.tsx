import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, CheckCircle2, Clock, AlertCircle, RefreshCw, UserCheck } from 'lucide-react'
import { agendaApi, type Reservation, type Slot } from './index'
import { useTenant } from '@shared/tenancy/TenantProvider'

type CatalogService = {
  id: string
  name: string
  durationMinutes: number
  price: number
  currency: string
}

type AuthUser = {
  id: string
  email: string
  roles: string[]
}

type Props = {
  selectedService: CatalogService
  selectedResourceId?: string
  currentUser: AuthUser | null
  onRequireAuth: () => void
  slug?: string
  businessId?: string
  websiteId?: string
}

export function AgendaBookingWidget({
  selectedService,
  selectedResourceId,
  currentUser,
  onRequireAuth,
  slug: propSlug,
  businessId: propBusinessId,
  websiteId: propWebsiteId,
}: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [confirmation, setConfirmation] = useState<Reservation | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isBooking, setIsBooking] = useState(false)

  const confirmationRef = useRef<HTMLDivElement>(null)

  const tenant = useTenant()
  const businessId = propBusinessId || tenant?.businessId
  const websiteId = propWebsiteId || tenant?.websiteId

  // Determine fallback slug if available
  const resolvedSlug =
    propSlug ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/sites/')
      ? window.location.pathname.split('/')[2]
      : '')

  const fetchSlots = useCallback(async () => {
    if (!selectedResourceId) {
      setSlots([])
      setLoadingSlots(false)
      setSlotError(null)
      return
    }

    setLoadingSlots(true)
    setSlotError(null)
    setSelectedSlot(null)

    try {
      const response = await agendaApi.slots(
        selectedResourceId,
        date,
        selectedService.durationMinutes,
        resolvedSlug || undefined,
        { businessId, websiteId },
      )
      setSlots(response.data || [])
    } catch {
      setSlotError('Unable to load available time slots. Please try again.')
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedResourceId, date, selectedService.durationMinutes, resolvedSlug, businessId, websiteId])

  useEffect(() => {
    void fetchSlots()
  }, [fetchSlots])

  // Scroll into view when booking is confirmed
  useEffect(() => {
    if (confirmation && confirmationRef.current) {
      confirmationRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [confirmation])

  async function book() {
    if (!currentUser) {
      onRequireAuth()
      return
    }
    if (!selectedSlot || !selectedResourceId) return

    setIsBooking(true)
    try {
      const { data } = await agendaApi.book({
        resourceId: selectedResourceId,
        clientId: currentUser.id,
        startAtUtc: selectedSlot.startTimeUtc,
        endAtUtc: selectedSlot.endTimeUtc,
        status: 'Pending',
        serviceSnapshot: {
          serviceName: selectedService.name,
          price: selectedService.price,
          durationMinutes: selectedService.durationMinutes,
        },
      })
      setConfirmation(data)
      const mine = await agendaApi.myReservations()
      setReservations(mine.data)
      // Refetch slots to remove the booked slot
      void fetchSlots()
    } catch {
      setSlotError('Failed to complete booking. That time slot may have just been reserved.')
    } finally {
      setIsBooking(false)
    }
  }

  const formatSlotTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <section className="agenda-booking-widget max-w-4xl mx-auto my-12 p-6 md:p-8 bg-white rounded-3xl border border-stone-200 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#b26c59] font-semibold">
            Appointment Booking
          </span>
          <h2 className="text-2xl md:text-3xl font-serif font-semibold text-stone-900 mt-1">
            Book {selectedService.name}
          </h2>
          <div className="flex items-center gap-3 text-sm text-stone-500 mt-1.5">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4 text-stone-400" />
              {selectedService.durationMinutes} minutes
            </span>
            <span>•</span>
            <span className="font-medium text-stone-800">
              {selectedService.price} {selectedService.currency}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <input
              type="date"
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#b26c59]"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Notice Banner: Missing artist selection */}
      {!selectedResourceId && (
        <div
          role="status"
          className="my-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 animate-pulse"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium">
            ← Please select a nail artist above to see availability
          </p>
        </div>
      )}

      {/* Slot error notice with retry option */}
      {slotError && selectedResourceId && (
        <div
          role="alert"
          className="my-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{slotError}</span>
          </div>
          <button
            type="button"
            className="px-3 py-1 bg-white border border-rose-200 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
            onClick={() => void fetchSlots()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Available Slots Section */}
      <div className="my-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">
            Available Times
          </h3>
          {slots.length > 0 && selectedResourceId && (
            <span className="text-xs text-stone-500">
              {slots.length} {slots.length === 1 ? 'slot' : 'slots'} available
            </span>
          )}
        </div>

        {/* Loading Skeleton */}
        {loadingSlots && selectedResourceId && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <div
                key={n}
                className="h-11 rounded-xl bg-stone-100 border border-stone-200/60"
              />
            ))}
          </div>
        )}

        {/* Loaded slots */}
        {!loadingSlots && selectedResourceId && slots.length > 0 && (
          <div className="slots grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {slots.map((slot) => {
              const isSelected = selectedSlot?.startTimeUtc === slot.startTimeUtc
              return (
                <button
                  key={slot.startTimeUtc}
                  type="button"
                  disabled={!selectedResourceId}
                  className={`px-3 py-2.5 text-sm font-medium rounded-xl border transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'bg-[#b26c59] text-white border-[#b26c59] shadow-sm scale-102 ring-2 ring-[#b26c59]/20'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                  }`}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {formatSlotTime(slot.startTimeUtc)}
                </button>
              )
            })}
          </div>
        )}

        {/* Empty slots notice */}
        {!loadingSlots && selectedResourceId && slots.length === 0 && !slotError && (
          <div className="text-center py-10 px-4 rounded-2xl bg-stone-50 border border-dashed border-stone-200 text-stone-500">
            <Clock className="w-8 h-8 mx-auto text-stone-400 mb-2 opacity-60" />
            <p className="text-sm font-medium">No available slots on this date.</p>
            <p className="text-xs text-stone-400 mt-1">Please select another date or artist.</p>
          </div>
        )}
      </div>

      {/* Booking Action Button */}
      <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-stone-500">
          {selectedSlot ? (
            <span className="font-medium text-stone-800">
              Selected: {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {formatSlotTime(selectedSlot.startTimeUtc)}
            </span>
          ) : (
            <span>Please choose an available time slot</span>
          )}
        </div>

        <button
          type="button"
          disabled={!selectedResourceId || !selectedSlot || isBooking}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-white bg-[#b26c59] hover:bg-[#9c5947] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer inline-flex items-center justify-center gap-2"
          onClick={() => void book()}
        >
          {isBooking ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Reserving spot…
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4" />
              Reserve Spot
            </>
          )}
        </button>
      </div>

      {/* Confirmation message card with ref for auto-scroll */}
      {confirmation && (
        <div
          ref={confirmationRef}
          role="status"
          className="mt-8 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-emerald-950">
                Booking Confirmed!
              </h3>
              <p className="text-sm text-emerald-800 mt-1">
                Your reservation for <strong>{selectedService.name}</strong> has been received for{' '}
                <strong>{new Date(confirmation.startAtUtc).toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}</strong>.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                Status: {confirmation.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Reservations list if authenticated */}
      {currentUser && reservations.length > 0 && (
        <div className="mt-10 pt-6 border-t border-stone-100">
          <h3 className="text-base font-semibold text-stone-900 mb-3">My Reservations</h3>
          <ul className="space-y-2">
            {reservations.map((item) => (
              <li
                key={item.id}
                className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium text-stone-800">
                    {item.serviceSnapshot?.serviceName || 'Nail Service'}
                  </span>
                  <p className="text-xs text-stone-500">
                    {new Date(item.startAtUtc).toLocaleString()}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-200 text-stone-700">
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
