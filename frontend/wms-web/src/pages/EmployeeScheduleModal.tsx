import { useEffect, useState } from 'react'
import { Calendar, Clock, Plus, Trash2, X, Check, Coffee } from 'lucide-react'
import { employeesApi, type EmployeeProfile } from '@modules/employees'
import { useToast } from '@shared/ui/Toast'

type DayConfig = {
  day: number // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  label: string
  enabled: boolean
  startTime: string
  endTime: string
  hasBreak: boolean
  breakStart: string
  breakEnd: string
}

type DateOverride = {
  id: string
  date: string
  isUnavailable: boolean
  startTime: string
  endTime: string
  hasBreak: boolean
  breakStart: string
  breakEnd: string
}

const DEFAULT_DAYS: DayConfig[] = [
  { day: 1, label: 'Monday', enabled: true, startTime: '09:00', endTime: '17:00', hasBreak: true, breakStart: '12:00', breakEnd: '13:00' },
  { day: 2, label: 'Tuesday', enabled: true, startTime: '09:00', endTime: '17:00', hasBreak: true, breakStart: '12:00', breakEnd: '13:00' },
  { day: 3, label: 'Wednesday', enabled: true, startTime: '09:00', endTime: '17:00', hasBreak: true, breakStart: '12:00', breakEnd: '13:00' },
  { day: 4, label: 'Thursday', enabled: true, startTime: '09:00', endTime: '17:00', hasBreak: true, breakStart: '12:00', breakEnd: '13:00' },
  { day: 5, label: 'Friday', enabled: true, startTime: '09:00', endTime: '17:00', hasBreak: true, breakStart: '12:00', breakEnd: '13:00' },
  { day: 6, label: 'Saturday', enabled: false, startTime: '10:00', endTime: '16:00', hasBreak: false, breakStart: '12:00', breakEnd: '13:00' },
  { day: 0, label: 'Sunday', enabled: false, startTime: '10:00', endTime: '16:00', hasBreak: false, breakStart: '12:00', breakEnd: '13:00' },
]

export function EmployeeScheduleModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeProfile
  onClose: () => void
  onSaved?: () => void
}) {
  const [days, setDays] = useState<DayConfig[]>(DEFAULT_DAYS)
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [newOverrideDate, setNewOverrideDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newOverrideUnavailable, setNewOverrideUnavailable] = useState(true)
  const [newOverrideStart, setNewOverrideStart] = useState('09:00')
  const [newOverrideEnd, setNewOverrideEnd] = useState('17:00')
  const [newOverrideBreak, setNewOverrideBreak] = useState(false)
  const [newOverrideBreakStart, setNewOverrideBreakStart] = useState('12:00')
  const [newOverrideBreakEnd, setNewOverrideBreakEnd] = useState('13:00')
  const [activeTab, setActiveTab] = useState<'weekly' | 'overrides' | 'preview'>('weekly')
  const [saving, setSaving] = useState(false)

  const toast = useToast()

  // Load existing schedule
  useEffect(() => {
    let active = true
    employeesApi
      .getSchedule(employee.id)
      .then((res) => {
        if (!active || !res.data) return
        const data = res.data as {
          windows?: Array<{
            day: number
            startTime: string
            endTime: string
            breakStart?: string
            breakEnd?: string
          }>
          weeklyWindows?: Array<{
            day: number
            startTime: string
            endTime: string
            breakStart?: string
            breakEnd?: string
          }>
          dateOverrides?: Array<{
            date: string
            isUnavailable: boolean
            startTime?: string
            endTime?: string
            breakStart?: string
            breakEnd?: string
          }>
        }

        const rawWindows = data.windows || data.weeklyWindows || []
        if (rawWindows.length > 0) {
          setDays((prev) =>
            prev.map((item) => {
              const found = rawWindows.find((w) => w.day === item.day)
              if (found) {
                return {
                  ...item,
                  enabled: true,
                  startTime: found.startTime?.slice(0, 5) || '09:00',
                  endTime: found.endTime?.slice(0, 5) || '17:00',
                  hasBreak: Boolean(found.breakStart && found.breakEnd),
                  breakStart: found.breakStart?.slice(0, 5) || '12:00',
                  breakEnd: found.breakEnd?.slice(0, 5) || '13:00',
                }
              }
              return { ...item, enabled: false }
            }),
          )
        }

        if (data.dateOverrides && Array.isArray(data.dateOverrides)) {
          setOverrides(
            data.dateOverrides.map((o) => ({
              id: crypto.randomUUID(),
              date: o.date,
              isUnavailable: o.isUnavailable,
              startTime: o.startTime?.slice(0, 5) || '09:00',
              endTime: o.endTime?.slice(0, 5) || '17:00',
              hasBreak: Boolean(o.breakStart && o.breakEnd),
              breakStart: o.breakStart?.slice(0, 5) || '12:00',
              breakEnd: o.breakEnd?.slice(0, 5) || '13:00',
            })),
          )
        }
      })
      .catch(() => {
        // Not yet configured, default is fine
      })

    return () => {
      active = false
    }
  }, [employee.id])

  function updateDay(dayIndex: number, patch: Partial<DayConfig>) {
    setDays((prev) =>
      prev.map((item, idx) => (idx === dayIndex ? { ...item, ...patch } : item)),
    )
  }

  function addOverride() {
    if (!newOverrideDate) return
    const override: DateOverride = {
      id: crypto.randomUUID(),
      date: newOverrideDate,
      isUnavailable: newOverrideUnavailable,
      startTime: newOverrideStart,
      endTime: newOverrideEnd,
      hasBreak: newOverrideBreak,
      breakStart: newOverrideBreakStart,
      breakEnd: newOverrideBreakEnd,
    }
    setOverrides((prev) => [...prev, override])
    toast.success(`Date override added for ${newOverrideDate}`)
  }

  function removeOverride(id: string) {
    setOverrides((prev) => prev.filter((o) => o.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        windows: days
          .filter((d) => d.enabled)
          .map((d) => ({
            day: d.day,
            startTime: d.startTime.length === 5 ? `${d.startTime}:00` : d.startTime,
            endTime: d.endTime.length === 5 ? `${d.endTime}:00` : d.endTime,
            breakStart: d.hasBreak
              ? d.breakStart.length === 5 ? `${d.breakStart}:00` : d.breakStart
              : null,
            breakEnd: d.hasBreak
              ? d.breakEnd.length === 5 ? `${d.breakEnd}:00` : d.breakEnd
              : null,
          })),
        dateOverrides: overrides.map((o) => ({
          date: o.date,
          isUnavailable: o.isUnavailable,
          startTime: o.isUnavailable
            ? null
            : o.startTime.length === 5 ? `${o.startTime}:00` : o.startTime,
          endTime: o.isUnavailable
            ? null
            : o.endTime.length === 5 ? `${o.endTime}:00` : o.endTime,
          breakStart:
            o.isUnavailable || !o.hasBreak
              ? null
              : o.breakStart.length === 5 ? `${o.breakStart}:00` : o.breakStart,
          breakEnd:
            o.isUnavailable || !o.hasBreak
              ? null
              : o.breakEnd.length === 5 ? `${o.breakEnd}:00` : o.breakEnd,
        })),
      }

      await employeesApi.updateSchedule(employee.id, payload)
      toast.success(`Schedule updated successfully for ${employee.displayName}.`)
      onSaved?.()
      onClose()
    } catch {
      toast.error('Failed to save employee schedule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-stone-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#b26c59] font-semibold">
              Weekly Schedule Editor
            </span>
            <h2
              id="schedule-modal-title"
              className="text-xl font-serif font-semibold text-stone-900 mt-0.5"
            >
              Working Hours: {employee.displayName}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 border-b border-stone-100 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('weekly')}
            className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === 'weekly'
                ? 'border-[#b26c59] text-[#b26c59]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            Weekly Recurring
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overrides')}
            className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === 'overrides'
                ? 'border-[#b26c59] text-[#b26c59]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            Date Overrides ({overrides.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === 'preview'
                ? 'border-[#b26c59] text-[#b26c59]'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            Visual Preview
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: WEEKLY RECURRING HOURS */}
          {activeTab === 'weekly' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 mb-2">
                Configure standard working hours and optional lunch/break windows for each day of the week.
              </p>
              {days.map((day, idx) => (
                <div
                  key={day.day}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    day.enabled
                      ? 'border-stone-200 bg-white shadow-xs'
                      : 'border-stone-100 bg-stone-50/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) => updateDay(idx, { enabled: e.target.checked })}
                        className="w-4 h-4 rounded text-[#b26c59] focus:ring-[#b26c59]"
                      />
                      <span className="font-semibold text-stone-800 text-sm w-28">
                        {day.label}
                      </span>
                    </label>

                    {day.enabled ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => updateDay(idx, { startTime: e.target.value })}
                            className="px-2 py-1 rounded-lg border border-stone-200 text-xs font-mono"
                          />
                          <span>–</span>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => updateDay(idx, { endTime: e.target.value })}
                            className="px-2 py-1 rounded-lg border border-stone-200 text-xs font-mono"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer ml-2">
                          <input
                            type="checkbox"
                            checked={day.hasBreak}
                            onChange={(e) => updateDay(idx, { hasBreak: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-[#b26c59]"
                          />
                          <Coffee className="w-3.5 h-3.5 text-stone-400" />
                          <span>Break</span>
                        </label>

                        {day.hasBreak && (
                          <div className="flex items-center gap-1 text-xs font-medium text-stone-700">
                            <input
                              type="time"
                              value={day.breakStart}
                              onChange={(e) => updateDay(idx, { breakStart: e.target.value })}
                              className="px-1.5 py-1 rounded-lg border border-stone-200 text-xs font-mono"
                            />
                            <span>–</span>
                            <input
                              type="time"
                              value={day.breakEnd}
                              onChange={(e) => updateDay(idx, { breakEnd: e.target.value })}
                              className="px-1.5 py-1 rounded-lg border border-stone-200 text-xs font-mono"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400 italic">Day off / Closed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: DATE OVERRIDES */}
          {activeTab === 'overrides' && (
            <div className="space-y-6">
              {/* Form to add override */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Add Single-Day Override
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-stone-600">
                    Target Date
                    <input
                      type="date"
                      value={newOverrideDate}
                      onChange={(e) => setNewOverrideDate(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium bg-white"
                    />
                  </label>

                  <div className="flex flex-col justify-end">
                    <label className="text-xs text-stone-600 mb-1">Availability Type</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="radio"
                          name="overrideType"
                          checked={newOverrideUnavailable}
                          onChange={() => setNewOverrideUnavailable(true)}
                          className="text-[#b26c59]"
                        />
                        <span>Unavailable (Off)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="radio"
                          name="overrideType"
                          checked={!newOverrideUnavailable}
                          onChange={() => setNewOverrideUnavailable(false)}
                          className="text-[#b26c59]"
                        />
                        <span>Custom Hours</span>
                      </label>
                    </div>
                  </div>
                </div>

                {!newOverrideUnavailable && (
                  <div className="pt-2 border-t border-stone-200/60 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-stone-700">
                      <span>Hours:</span>
                      <input
                        type="time"
                        value={newOverrideStart}
                        onChange={(e) => setNewOverrideStart(e.target.value)}
                        className="px-2 py-1 rounded-lg border border-stone-200 text-xs bg-white"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={newOverrideEnd}
                        onChange={(e) => setNewOverrideEnd(e.target.value)}
                        className="px-2 py-1 rounded-lg border border-stone-200 text-xs bg-white"
                      />
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newOverrideBreak}
                        onChange={(e) => setNewOverrideBreak(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#b26c59]"
                      />
                      <span>Break</span>
                    </label>

                    {newOverrideBreak && (
                      <div className="flex items-center gap-1 text-xs text-stone-700">
                        <input
                          type="time"
                          value={newOverrideBreakStart}
                          onChange={(e) => setNewOverrideBreakStart(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-stone-200 text-xs bg-white"
                        />
                        <span>–</span>
                        <input
                          type="time"
                          value={newOverrideBreakEnd}
                          onChange={(e) => setNewOverrideBreakEnd(e.target.value)}
                          className="px-2 py-1 rounded-lg border border-stone-200 text-xs bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={addOverride}
                  className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-medium hover:bg-stone-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Date Override
                </button>
              </div>

              {/* List of existing overrides */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Configured Overrides
                </h4>
                {overrides.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No date overrides configured.</p>
                ) : (
                  overrides.map((override) => (
                    <div
                      key={override.id}
                      className="p-3 rounded-xl border border-stone-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        <span className="font-semibold text-stone-800 font-mono">
                          {override.date}
                        </span>
                        {override.isUnavailable ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-medium">
                            Unavailable / Holiday
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium font-mono">
                            {override.startTime} – {override.endTime}
                            {override.hasBreak
                              ? ` (Break: ${override.breakStart}–${override.breakEnd})`
                              : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Delete override"
                        onClick={() => removeOverride(override.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VISUAL WEEKLY CALENDAR PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">
                Visual preview of the standard weekly schedule timeline (08:00 – 20:00).
              </p>
              <div className="grid grid-cols-7 gap-2 border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
                {days.map((day) => {
                  // Timeline 8:00 to 20:00 = 12 hours
                  const startHour = Number(day.startTime.slice(0, 2)) + Number(day.startTime.slice(3, 5)) / 60
                  const endHour = Number(day.endTime.slice(0, 2)) + Number(day.endTime.slice(3, 5)) / 60
                  const topPercent = Math.max(0, ((startHour - 8) / 12) * 100)
                  const heightPercent = Math.max(5, ((endHour - startHour) / 12) * 100)

                  const breakStartH = Number(day.breakStart.slice(0, 2)) + Number(day.breakStart.slice(3, 5)) / 60
                  const breakEndH = Number(day.breakEnd.slice(0, 2)) + Number(day.breakEnd.slice(3, 5)) / 60
                  const breakTopPercent = Math.max(0, ((breakStartH - 8) / 12) * 100)
                  const breakHeightPercent = Math.max(4, ((breakEndH - breakStartH) / 12) * 100)

                  return (
                    <div key={day.day} className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-stone-700 uppercase mb-2">
                        {day.label.slice(0, 3)}
                      </span>
                      <div className="w-full h-48 bg-white border border-stone-200 rounded-xl relative overflow-hidden">
                        {day.enabled ? (
                          <>
                            {/* Working Hours Bar */}
                            <div
                              style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                              className="absolute left-1 right-1 bg-emerald-500/80 rounded border border-emerald-600 flex flex-col justify-between p-1 text-[9px] text-white font-medium overflow-hidden"
                            >
                              <span>{day.startTime}</span>
                              <span>{day.endTime}</span>
                            </div>
                            {/* Break Bar */}
                            {day.hasBreak && (
                              <div
                                style={{ top: `${breakTopPercent}%`, height: `${breakHeightPercent}%` }}
                                className="absolute left-1 right-1 bg-amber-400 border border-amber-500 rounded z-10 flex items-center justify-center text-[8px] text-amber-950 font-bold"
                              >
                                Break
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-stone-400 font-medium bg-stone-100/50">
                            Off
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500 mt-1.5 truncate max-w-full">
                        {day.enabled ? `${day.startTime}–${day.endTime}` : 'Closed'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#b26c59] hover:bg-[#9c5947] disabled:opacity-50 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Weekly Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

