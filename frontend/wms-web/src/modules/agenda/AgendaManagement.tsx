import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Mail,
  Phone,
  X,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { agendaApi, type Reservation } from './index'
import { httpClient } from '@shared/api/httpClient'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { useToast } from '@shared/ui/Toast'

type EmployeeResource = {
  id: string
  displayName: string
  roleTitle?: string
  colorHex?: string
  avatarUrl?: string
  isActive: boolean
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const START_HOUR = 8
const END_HOUR = 20
const TOTAL_HOURS = END_HOUR - START_HOUR

export function AgendaManagement() {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [employees, setEmployees] = useState<EmployeeResource[]>([])
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  // Slide-over panel state
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState<Reservation | null>(null)

  // Reschedule form in slide-over
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleResourceId, setRescheduleResourceId] = useState('')

  // Drag-and-drop state
  const [draggedResId, setDraggedResId] = useState<string | null>(null)

  const toast = useToast()

  // Active employees
  const activeEmployees = useMemo(
    () => employees.filter((emp) => emp.isActive),
    [employees],
  )

  // Load employees
  useEffect(() => {
    let active = true
    httpClient
      .get<EmployeeResource[]>('/api/employees')
      .then(({ data }) => {
        if (active) setEmployees(data)
      })
      .catch(() => {
        // Fallback if not configured
      })
    return () => {
      active = false
    }
  }, [])

  // Calculate week days (Monday - Sunday)
  const weekDays = useMemo(() => {
    const monday = new Date(currentDate)
    const day = (currentDate.getDay() + 6) % 7
    monday.setDate(currentDate.getDate() - day)
    monday.setHours(0, 0, 0, 0)

    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + index)
      return d
    })
  }, [currentDate])

  // Load reservations for current day or week
  const loadReservations = useCallback(async () => {
    setLoading(true)
    try {
      let from: string
      let to: string

      if (viewMode === 'day') {
        const start = new Date(currentDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(currentDate)
        end.setHours(23, 59, 59, 999)
        from = start.toISOString()
        to = end.toISOString()
      } else {
        const start = new Date(weekDays[0])
        start.setHours(0, 0, 0, 0)
        const end = new Date(weekDays[6])
        end.setHours(23, 59, 59, 999)
        from = start.toISOString()
        to = end.toISOString()
      }

      const response = await agendaApi.list({ from, to })
      setReservations(response.data || [])

      // Update selected reservation if opened
      if (selectedRes) {
        const updated = response.data?.find((r) => r.id === selectedRes.id)
        if (updated) setSelectedRes(updated)
      }
    } catch {
      toast.error('Failed to load reservations.')
    } finally {
      setLoading(false)
    }
  }, [viewMode, currentDate, weekDays, selectedRes, toast])

  useEffect(() => {
    void loadReservations()
  }, [viewMode, currentDate.toDateString()])

  // When selected reservation opens, prepopulate edit states
  useEffect(() => {
    if (selectedRes) {
      setEditNotes(selectedRes.notes || '')
      const start = new Date(selectedRes.startAtUtc)
      setRescheduleDate(start.toISOString().slice(0, 10))
      setRescheduleTime(
        start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      )
      setRescheduleResourceId(selectedRes.resourceId)
    }
  }, [selectedRes])

  // Navigation handlers
  function navigateDate(direction: -1 | 1) {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (viewMode === 'day') {
        next.setDate(prev.getDate() + direction)
      } else {
        next.setDate(prev.getDate() + direction * 7)
      }
      return next
    })
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  // Update reservation status
  async function handleStatusChange(reservation: Reservation, nextStatus: string) {
    if (nextStatus === 'Cancelled') {
      setCancelConfirmTarget(reservation)
      return
    }

    try {
      await agendaApi.update(reservation.id, { status: nextStatus })
      toast.success(`Booking status changed to ${nextStatus}.`)
      await loadReservations()
    } catch {
      toast.error('Failed to update booking status.')
    }
  }

  // Cancel reservation
  async function confirmCancel() {
    if (!cancelConfirmTarget) return
    try {
      await agendaApi.cancel(cancelConfirmTarget.id)
      toast.success('Reservation cancelled successfully.')
      setCancelConfirmTarget(null)
      if (selectedRes?.id === cancelConfirmTarget.id) {
        setSelectedRes(null)
      }
      await loadReservations()
    } catch {
      toast.error('Failed to cancel reservation.')
    }
  }

  // Save notes
  async function saveNotes() {
    if (!selectedRes) return
    try {
      await agendaApi.update(selectedRes.id, { notes: editNotes })
      toast.success('Notes saved.')
      await loadReservations()
    } catch {
      toast.error('Failed to save notes.')
    }
  }

  // Reschedule reservation
  async function handleReschedule() {
    if (!selectedRes || !rescheduleDate || !rescheduleTime || !rescheduleResourceId) return

    try {
      const [hours, minutes] = rescheduleTime.split(':').map(Number)
      const newStart = new Date(rescheduleDate)
      newStart.setHours(hours, minutes, 0, 0)

      const origStart = new Date(selectedRes.startAtUtc).getTime()
      const origEnd = new Date(selectedRes.endAtUtc).getTime()
      const durationMs = Math.max(origEnd - origStart, 30 * 60 * 1000)

      const newEnd = new Date(newStart.getTime() + durationMs)

      await agendaApi.update(selectedRes.id, {
        startAtUtc: newStart.toISOString(),
        endAtUtc: newEnd.toISOString(),
        resourceId: rescheduleResourceId,
      })

      toast.success('Reservation rescheduled successfully.')
      await loadReservations()
    } catch {
      toast.error('Failed to reschedule reservation.')
    }
  }

  // Drag & drop handlers
  function handleDragStart(e: DragEvent<HTMLDivElement>, reservationId: string) {
    e.dataTransfer.setData('text/plain', reservationId)
    setDraggedResId(reservationId)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(
    e: DragEvent<HTMLDivElement>,
    targetResourceId: string,
    targetDate: Date,
    targetHour: number,
  ) {
    e.preventDefault()
    const resId = e.dataTransfer.getData('text/plain') || draggedResId
    if (!resId) return

    const res = reservations.find((r) => r.id === resId)
    if (!res) return

    const newStart = new Date(targetDate)
    newStart.setHours(targetHour, 0, 0, 0)

    const origStart = new Date(res.startAtUtc).getTime()
    const origEnd = new Date(res.endAtUtc).getTime()
    const durationMs = Math.max(origEnd - origStart, 30 * 60 * 1000)
    const newEnd = new Date(newStart.getTime() + durationMs)

    try {
      await agendaApi.update(res.id, {
        startAtUtc: newStart.toISOString(),
        endAtUtc: newEnd.toISOString(),
        resourceId: targetResourceId,
      })
      toast.success(`Rescheduled to ${newStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
      await loadReservations()
    } catch {
      toast.error('Failed to move reservation.')
    } finally {
      setDraggedResId(null)
    }
  }

  // Status block styling
  function getStatusStyles(status: string) {
    switch (status) {
      case 'Confirmed':
        return 'bg-emerald-50 border-emerald-300 text-emerald-900 border-l-4 border-l-emerald-500 hover:bg-emerald-100'
      case 'Completed':
        return 'bg-sky-50 border-sky-300 text-sky-900 border-l-4 border-l-sky-500 hover:bg-sky-100'
      case 'Cancelled':
        return 'bg-stone-100 border-stone-300 text-stone-500 line-through border-l-4 border-l-stone-400 opacity-60'
      case 'Pending':
      default:
        return 'bg-amber-50 border-amber-300 text-amber-900 border-l-4 border-l-amber-500 hover:bg-amber-100'
    }
  }

  // Calculate block position
  function calculateBlockLayout(startUtc: string, endUtc: string) {
    const start = new Date(startUtc)
    const end = new Date(endUtc)

    const startDecimal = start.getHours() + start.getMinutes() / 60
    const endDecimal = end.getHours() + end.getMinutes() / 60

    const clampedStart = Math.max(startDecimal, START_HOUR)
    const clampedEnd = Math.min(endDecimal, END_HOUR)

    const topPercent = Math.max(0, ((clampedStart - START_HOUR) / TOTAL_HOURS) * 100)
    const heightPercent = Math.max(4, ((Math.max(clampedEnd - clampedStart, 0.4)) / TOTAL_HOURS) * 100)

    return { top: `${topPercent}%`, height: `${heightPercent}%` }
  }

  return (
    <section className="agenda-management flex flex-col h-full">
      {/* Top Controls Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#b26c59] font-semibold">
            Operations & Scheduling
          </span>
          <h1 className="text-2xl lg:text-3xl font-serif font-semibold text-stone-900 mt-1">
            Agenda Calendar
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Manage nail artist bookings, drag to reschedule, and inspect appointments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Day / Week Toggle */}
          <div className="inline-flex rounded-xl p-1 bg-stone-100 border border-stone-200">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              onClick={() => setViewMode('day')}
            >
              Day view
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              onClick={() => setViewMode('week')}
            >
              Week view
            </button>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-2 py-1 shadow-xs">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => navigateDate(-1)}
              className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => navigateDate(1)}
              className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="h-4 w-px bg-stone-200 mx-1" />
            <input
              type="date"
              className="text-xs font-medium text-stone-800 bg-transparent border-0 focus:outline-none cursor-pointer"
              value={currentDate.toISOString().slice(0, 10)}
              onChange={(e) => {
                if (e.target.value) setCurrentDate(new Date(`${e.target.value}T12:00:00`))
              }}
            />
          </div>

          {/* Week view employee filter */}
          {viewMode === 'week' && (
            <select
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white text-stone-800 shadow-xs focus:ring-2 focus:ring-[#b26c59]"
            >
              <option value="all">All nail artists</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Date Header Title */}
      <div className="py-3 flex items-center justify-between text-sm">
        <strong className="text-stone-900 font-medium">
          {viewMode === 'day'
            ? currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
        </strong>
        <span className="text-xs text-stone-500">
          {reservations.length} {reservations.length === 1 ? 'booking' : 'bookings'}
          {loading ? ' (updating…)' : ''}
        </span>
      </div>

      {/* CALENDAR GRID */}
      <div className="flex-1 min-h-[620px] bg-white border border-stone-200 rounded-2xl shadow-xs overflow-auto relative flex">
        {/* Left Column: Hours Axis (08:00 – 20:00) */}
        <div className="w-16 shrink-0 border-r border-stone-200 bg-stone-50/60 select-none z-10 sticky left-0">
          <div className="h-12 border-b border-stone-200 flex items-center justify-center text-[10px] uppercase font-semibold text-stone-400">
            Time
          </div>
          <div className="relative h-[720px]">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ top: `${((hour - START_HOUR) / TOTAL_HOURS) * 100}%` }}
                className="absolute left-0 right-0 -translate-y-1/2 text-right pr-2 text-xs font-mono text-stone-400"
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {/* DAY VIEW: Columns = Active Employees */}
        {viewMode === 'day' && (
          <div className="flex-1 flex min-w-[700px]">
            {activeEmployees.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-stone-400">
                <User className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-medium">No active nail artists found.</p>
                <p className="text-xs">Add employees in the Employees section to display them here.</p>
              </div>
            ) : (
              activeEmployees.map((employee) => {
                const employeeReservations = reservations.filter((r) => {
                  if (r.resourceId !== employee.id) return false
                  const resDate = new Date(r.startAtUtc).toISOString().slice(0, 10)
                  return resDate === currentDate.toISOString().slice(0, 10)
                })

                return (
                  <div
                    key={employee.id}
                    className="flex-1 min-w-[180px] border-r border-stone-200 last:border-r-0 flex flex-col relative"
                  >
                    {/* Column Header */}
                    <div className="h-12 border-b border-stone-200 px-3 flex items-center gap-2 bg-stone-50 sticky top-0 z-10">
                      {employee.avatarUrl ? (
                        <img
                          src={employee.avatarUrl}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover border border-stone-200 shrink-0"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: employee.colorHex || '#b26c59' }}
                        >
                          {employee.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <span className="block text-xs font-semibold text-stone-800 truncate">
                          {employee.displayName}
                        </span>
                        <span className="block text-[10px] text-stone-400 truncate">
                          {employee.roleTitle || 'Artist'}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Grid Body */}
                    <div className="relative h-[720px] flex-1">
                      {/* Grid Lines per Hour */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          onDragOver={handleDragOver}
                          onDrop={(e) => void handleDrop(e, employee.id, currentDate, hour)}
                          style={{ top: `${((hour - START_HOUR) / TOTAL_HOURS) * 100}%` }}
                          className="absolute left-0 right-0 h-[60px] border-b border-stone-100 hover:bg-stone-50/50 transition-colors"
                        />
                      ))}

                      {/* Placed Reservations */}
                      {employeeReservations.map((res) => {
                        const layout = calculateBlockLayout(res.startAtUtc, res.endAtUtc)
                        const statusClass = getStatusStyles(res.status)

                        return (
                          <div
                            key={res.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, res.id)}
                            onClick={() => setSelectedRes(res)}
                            style={{ top: layout.top, height: layout.height }}
                            className={`absolute left-1 right-1 p-2 rounded-xl border text-xs cursor-pointer shadow-xs transition-transform active:scale-98 overflow-hidden z-20 ${statusClass}`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>
                                {new Date(res.startAtUtc).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/70 font-medium">
                                {res.status}
                              </span>
                            </div>
                            <strong className="block text-stone-900 font-medium truncate mt-0.5">
                              {res.clientSnapshot?.name || 'Client'}
                            </strong>
                            <p className="text-[11px] opacity-80 truncate">
                              {res.serviceSnapshot?.serviceName || 'Service'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* WEEK VIEW: Columns = 7 Days (Mon - Sun) */}
        {viewMode === 'week' && (
          <div className="flex-1 flex min-w-[900px]">
            {weekDays.map((dayDate) => {
              const dayStr = dayDate.toISOString().slice(0, 10)
              const isToday = dayStr === new Date().toISOString().slice(0, 10)

              const dayReservations = reservations.filter((r) => {
                const resDate = new Date(r.startAtUtc).toISOString().slice(0, 10)
                if (resDate !== dayStr) return false
                if (selectedEmployeeFilter !== 'all' && r.resourceId !== selectedEmployeeFilter) {
                  return false
                }
                return true
              })

              return (
                <div
                  key={dayStr}
                  className={`flex-1 min-w-[130px] border-r border-stone-200 last:border-r-0 flex flex-col relative ${
                    isToday ? 'bg-amber-50/20' : ''
                  }`}
                >
                  {/* Column Header */}
                  <div
                    className={`h-12 border-b border-stone-200 px-2 flex flex-col items-center justify-center sticky top-0 z-10 ${
                      isToday ? 'bg-amber-50 text-[#b26c59]' : 'bg-stone-50 text-stone-700'
                    }`}
                  >
                    <span className="text-[11px] uppercase font-bold">
                      {dayDate.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span className={`text-xs font-medium ${isToday ? 'font-bold' : ''}`}>
                      {dayDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Timeline Grid Body */}
                  <div className="relative h-[720px] flex-1">
                    {/* Hour Lines */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        onDragOver={handleDragOver}
                        onDrop={(e) => {
                          const fallbackResourceId =
                            selectedEmployeeFilter !== 'all'
                              ? selectedEmployeeFilter
                              : activeEmployees[0]?.id || ''
                          void handleDrop(e, fallbackResourceId, dayDate, hour)
                        }}
                        style={{ top: `${((hour - START_HOUR) / TOTAL_HOURS) * 100}%` }}
                        className="absolute left-0 right-0 h-[60px] border-b border-stone-100 hover:bg-stone-50/50 transition-colors"
                      />
                    ))}

                    {/* Placed Reservations */}
                    {dayReservations.map((res) => {
                      const layout = calculateBlockLayout(res.startAtUtc, res.endAtUtc)
                      const statusClass = getStatusStyles(res.status)
                      const assignedEmp = employees.find((e) => e.id === res.resourceId)

                      return (
                        <div
                          key={res.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, res.id)}
                          onClick={() => setSelectedRes(res)}
                          style={{ top: layout.top, height: layout.height }}
                          className={`absolute left-1 right-1 p-1.5 rounded-xl border text-[11px] cursor-pointer shadow-xs transition-transform active:scale-98 overflow-hidden z-20 ${statusClass}`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>
                              {new Date(res.startAtUtc).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[9px] px-1 rounded-full bg-white/70">
                              {res.status}
                            </span>
                          </div>
                          <strong className="block text-stone-900 font-medium truncate mt-0.5">
                            {res.clientSnapshot?.name || 'Client'}
                          </strong>
                          {assignedEmp && (
                            <span className="block text-[10px] text-stone-600 truncate">
                              w/ {assignedEmp.displayName}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SLIDE-OVER DETAILS PANEL */}
      {selectedRes && (
        <aside
          role="dialog"
          aria-label="Reservation Details"
          className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl border-l border-stone-200 z-50 flex flex-col animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#b26c59] font-semibold">
                Reservation Details
              </span>
              <h3 className="text-lg font-serif font-semibold text-stone-900">
                {selectedRes.serviceSnapshot?.serviceName || 'Nail Service'}
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelectedRes(null)}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Status & Change */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Booking Status
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedRes.status}
                  onChange={(e) => void handleStatusChange(selectedRes, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm font-medium bg-white focus:ring-2 focus:ring-[#b26c59]"
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase ${
                    selectedRes.status === 'Confirmed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedRes.status === 'Completed'
                        ? 'bg-sky-100 text-sky-800'
                        : selectedRes.status === 'Cancelled'
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {selectedRes.status}
                </span>
              </div>
            </div>

            {/* Client Info */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                Customer Information
              </span>
              <div className="flex items-center gap-2 text-sm text-stone-800 font-medium">
                <User className="w-4 h-4 text-stone-400" />
                <span>{selectedRes.clientSnapshot?.name || 'Walk-in / Unknown Client'}</span>
              </div>
              {selectedRes.clientSnapshot?.email && (
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <Mail className="w-4 h-4 text-stone-400" />
                  <a
                    href={`mailto:${selectedRes.clientSnapshot.email}`}
                    className="hover:underline text-stone-700"
                  >
                    {selectedRes.clientSnapshot.email}
                  </a>
                </div>
              )}
              {selectedRes.clientSnapshot?.phone && (
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <Phone className="w-4 h-4 text-stone-400" />
                  <a
                    href={`tel:${selectedRes.clientSnapshot.phone}`}
                    className="hover:underline text-stone-700"
                  >
                    {selectedRes.clientSnapshot.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Time & Service Info */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                Schedule & Artist
              </span>
              <div className="flex items-center gap-2 text-xs text-stone-700">
                <Clock className="w-4 h-4 text-stone-400" />
                <span>
                  {new Date(selectedRes.startAtUtc).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  •{' '}
                  {new Date(selectedRes.startAtUtc).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(selectedRes.endAtUtc).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-700">
                <Sparkles className="w-4 h-4 text-[#b26c59]" />
                <span>
                  Artist:{' '}
                  <strong>
                    {employees.find((e) => e.id === selectedRes.resourceId)?.displayName ||
                      'Assigned Artist'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Reschedule Section */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Reschedule Reservation
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-stone-600">
                  Date
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium"
                  />
                </label>
                <label className="text-xs text-stone-600">
                  Start Time
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium"
                  />
                </label>
              </div>
              <label className="block text-xs text-stone-600">
                Nail Artist
                <select
                  value={rescheduleResourceId}
                  onChange={(e) => setRescheduleResourceId(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium bg-white"
                >
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.displayName} ({emp.roleTitle || 'Artist'})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleReschedule()}
                className="w-full py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Confirm Reschedule
              </button>
            </div>

            {/* Notes Section */}
            <div className="border-t border-stone-100 pt-4 space-y-2">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Staff Notes
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add internal notes about client preferences, nail art requests, etc…"
                className="w-full p-2.5 rounded-xl border border-stone-200 text-xs text-stone-800 focus:ring-2 focus:ring-[#b26c59] resize-none"
              />
              <button
                type="button"
                onClick={() => void saveNotes()}
                className="px-3 py-1.5 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          </div>

          {/* Footer with Cancel Button */}
          <div className="p-5 border-t border-stone-100 bg-stone-50/50">
            <button
              type="button"
              disabled={selectedRes.status === 'Cancelled'}
              onClick={() => setCancelConfirmTarget(selectedRes)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Cancel Reservation
            </button>
          </div>
        </aside>
      )}

      {/* Confirmation Dialog for Cancellation */}
      <ConfirmDialog
        isOpen={cancelConfirmTarget !== null}
        title="Cancel Reservation"
        description={`Are you sure you want to cancel the booking for ${
          cancelConfirmTarget?.clientSnapshot?.name || 'this client'
        }? The slot will be freed up in the calendar.`}
        confirmLabel="Yes, Cancel Booking"
        isDestructive={true}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelConfirmTarget(null)}
      />
    </section>
  )
}
