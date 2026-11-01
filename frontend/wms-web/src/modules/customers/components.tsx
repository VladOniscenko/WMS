import { useState, useEffect, type FormEvent } from 'react'
import {
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react'
import { httpClient } from '@shared/api/httpClient'
import { customersApi, type CustomerProfile } from './index'

interface ReservationItem {
  id: string
  startAtUtc: string
  endAtUtc: string
  status: string
  serviceSnapshot?: {
    serviceName?: string
    price?: number
  }
}

interface CustomerProfileDrawerProps {
  defaultOpen?: boolean
  onClose?: () => void
}

export function CustomerProfileDrawer({
  defaultOpen = false,
  onClose,
}: CustomerProfileDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<'profile' | 'reservations'>('profile')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine: '',
    city: '',
    postalCode: '',
    country: '',
    consentMarketing: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reservations, setReservations] = useState<ReservationItem[]>([])

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      try {
        const { data: profile } = await customersApi.me()
        if (isMounted && profile) {
          setForm({
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            email: profile.email || '',
            phone: profile.phone || '',
            addressLine: profile.addressLine || '',
            city: profile.city || '',
            postalCode: profile.postalCode || '',
            country: profile.country || '',
            consentMarketing: Boolean(profile.consentMarketing),
          })
        }
      } catch {
        // User may not have loaded profile yet
      }

      try {
        const res = await httpClient.get<ReservationItem[]>('/api/agenda/reservations/my')
        if (isMounted && res.data) {
          setReservations(res.data)
        }
      } catch {
        // Agenda reservations may be empty or module disabled
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.firstName.trim()) {
      errs.firstName = 'First Name is required'
    }
    if (!form.lastName.trim()) {
      errs.lastName = 'Last Name is required'
    }

    if (form.phone.trim()) {
      // Allow international phone format (+country code, digits, dashes, spaces)
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,16}$/
      if (!phoneRegex.test(form.phone.trim())) {
        errs.phone = 'Please enter a valid phone number format (e.g. +31 6 12345678)'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setStatusMessage(null)

    if (!validate()) {
      return
    }

    setSaving(true)
    try {
      const payload: Partial<CustomerProfile> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
        consentMarketing: form.consentMarketing,
      }
      await customersApi.updateMe(payload)
      setStatusMessage({ type: 'success', text: 'Profile updated successfully.' })
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to update profile. Please check your connection and try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const now = new Date()
  const upcomingReservations = reservations
    .filter((r) => new Date(r.startAtUtc) >= now)
    .sort((a, b) => new Date(a.startAtUtc).getTime() - new Date(b.startAtUtc).getTime())
  const pastReservations = reservations
    .filter((r) => new Date(r.startAtUtc) < now)
    .sort((a, b) => new Date(b.startAtUtc).getTime() - new Date(a.startAtUtc).getTime())

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  return (
    <>
      {/* Floating launcher button if not open */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-stone-900 text-stone-100 shadow-xl hover:bg-stone-800 transition-all cursor-pointer border border-stone-700 text-sm font-medium"
          aria-label="Open customer profile"
        >
          <User className="w-4 h-4 text-[#e0a68d]" />
          <span>My Profile</span>
          {upcomingReservations.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-[#b26c59] text-white">
              {upcomingReservations.length}
            </span>
          )}
        </button>
      )}

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
              {/* Header */}
              <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#e0a68d]/30 text-[#8d4e40] flex items-center justify-center font-serif font-bold">
                    {form.firstName ? form.firstName[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900 leading-tight">
                      Customer Profile
                    </h2>
                    <p className="text-xs text-stone-500">
                      {form.email || 'Manage your account and appointments'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-stone-200 bg-stone-50/50 px-6 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'profile'
                      ? 'border-[#b26c59] text-[#b26c59]'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Personal Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reservations')}
                  className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'reservations'
                      ? 'border-[#b26c59] text-[#b26c59]'
                      : 'border-transparent text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Reservations</span>
                  {reservations.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-xs bg-stone-200 text-stone-700">
                      {reservations.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {statusMessage && (
                  <div
                    className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                      statusMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                )}

                {loading ? (
                  <div className="py-12 text-center text-sm text-stone-400">
                    Loading your profile details…
                  </div>
                ) : activeTab === 'profile' ? (
                  <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          First Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.firstName}
                          onChange={(e) => {
                            setForm({ ...form, firstName: e.target.value })
                            if (errors.firstName) setErrors({ ...errors, firstName: '' })
                          }}
                          placeholder="Jane"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59] ${
                            errors.firstName ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                          }`}
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-xs text-rose-600">{errors.firstName}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Last Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.lastName}
                          onChange={(e) => {
                            setForm({ ...form, lastName: e.target.value })
                            if (errors.lastName) setErrors({ ...errors, lastName: '' })
                          }}
                          placeholder="Doe"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59] ${
                            errors.lastName ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                          }`}
                        />
                        {errors.lastName && (
                          <p className="mt-1 text-xs text-rose-600">{errors.lastName}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        disabled
                        value={form.email}
                        placeholder="customer@example.com"
                        className="w-full px-3 py-2 text-sm border border-stone-200 bg-stone-100 text-stone-500 rounded-lg cursor-not-allowed"
                      />
                      <span className="text-[11px] text-stone-400 mt-0.5 block">
                        Email is linked to your login identity.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => {
                          setForm({ ...form, phone: e.target.value })
                          if (errors.phone) setErrors({ ...errors, phone: '' })
                        }}
                        placeholder="+31 6 12345678"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59] ${
                          errors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                        }`}
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-stone-100">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                        Address Information
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Address line
                          </label>
                          <input
                            type="text"
                            value={form.addressLine}
                            onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
                            placeholder="Keizersgracht 100"
                            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              value={form.city}
                              onChange={(e) => setForm({ ...form, city: e.target.value })}
                              placeholder="Amsterdam"
                              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-stone-700 mb-1">
                              Postal code
                            </label>
                            <input
                              type="text"
                              value={form.postalCode}
                              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                              placeholder="1015 AA"
                              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Country
                          </label>
                          <input
                            type="text"
                            value={form.country}
                            onChange={(e) => setForm({ ...form, country: e.target.value })}
                            placeholder="Netherlands"
                            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Marketing Consent */}
                    <div className="pt-3 border-t border-stone-100">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.consentMarketing}
                          onChange={(e) =>
                            setForm({ ...form, consentMarketing: e.target.checked })
                          }
                          className="mt-1 h-4 w-4 rounded border-stone-300 text-[#b26c59] focus:ring-[#b26c59]"
                        />
                        <span className="text-xs text-stone-600 leading-normal">
                          <strong className="text-stone-800">Marketing consent</strong>: Keep me
                          informed of seasonal treatments, promotions, and special studio updates.
                        </span>
                      </label>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#b26c59] hover:bg-[#8d4e40] text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <span>Saving…</span>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Save profile</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Reservations tab */
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                        Upcoming Reservations ({upcomingReservations.length})
                      </h3>
                      {upcomingReservations.length === 0 ? (
                        <p className="text-xs text-stone-500 bg-stone-50 p-4 rounded-lg border border-stone-100 text-center">
                          No upcoming reservations.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {upcomingReservations.map((res) => (
                            <div
                              key={res.id}
                              className="p-3.5 rounded-xl border border-stone-200 bg-white shadow-xs hover:border-[#b26c59]/40 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-stone-900">
                                    {res.serviceSnapshot?.serviceName || 'Service appointment'}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
                                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                                    <span>
                                      {new Date(res.startAtUtc).toLocaleDateString([], {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    <Clock className="w-3.5 h-3.5 text-stone-400 ml-1" />
                                    <span>
                                      {new Date(res.startAtUtc).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {res.status || 'Confirmed'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                        Past Reservations ({pastReservations.length})
                      </h3>
                      {pastReservations.length === 0 ? (
                        <p className="text-xs text-stone-500 bg-stone-50 p-4 rounded-lg border border-stone-100 text-center">
                          No past reservation history.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {pastReservations.map((res) => (
                            <div
                              key={res.id}
                              className="p-3 rounded-lg border border-stone-100 bg-stone-50/60 opacity-80"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-xs font-semibold text-stone-800">
                                    {res.serviceSnapshot?.serviceName || 'Appointment'}
                                  </h4>
                                  <div className="text-[11px] text-stone-500 mt-0.5">
                                    {new Date(res.startAtUtc).toLocaleDateString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}{' '}
                                    at{' '}
                                    {new Date(res.startAtUtc).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </div>
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-stone-200 text-stone-600">
                                  {res.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
