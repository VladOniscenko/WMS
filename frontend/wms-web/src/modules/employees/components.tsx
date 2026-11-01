import { useEffect, useState } from 'react'
import { Sparkles, Check, User } from 'lucide-react'
import { employeesApi, type EmployeeProfile } from './index'

type SelectedServiceInfo = {
  id: string
  name: string
  durationMinutes: number
  price?: number
  currency?: string
}

type Props = {
  onSelect?: (employee: EmployeeProfile) => void
  selectedService?: SelectedServiceInfo | null
  selectedEmployeeId?: string
}

export function NailistsShowcase({ onSelect, selectedService, selectedEmployeeId }: Props) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    employeesApi
      .public(selectedService?.id ? { serviceId: selectedService.id } : undefined)
      .then(({ data }) => {
        if (active) {
          setEmployees(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedService?.id])

  // Double check client-side filtering matching against employee.serviceIds if provided
  const displayedEmployees = selectedService
    ? employees.filter((employee) => {
        if (!employee.serviceIds || employee.serviceIds.length === 0) return true
        return employee.serviceIds.includes(selectedService.id)
      })
    : employees

  return (
    <section className="nailists-showcase my-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-serif font-semibold text-stone-900">
            Meet our nail artists
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {selectedService
              ? `Select an artist offering ${selectedService.name} to view their open slots`
              : 'Choose a nail artist to see availability'}
          </p>
        </div>
        {selectedService && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-medium border border-stone-200">
            Service: {selectedService.name} ({selectedService.durationMinutes} min)
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-stone-100 animate-pulse border border-stone-200" />
          ))}
        </div>
      ) : displayedEmployees.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-stone-200 text-stone-500">
          <p className="text-sm font-medium">No nail artists available for this service.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {displayedEmployees.map((employee) => {
            const isSelected = selectedEmployeeId === employee.id
            return (
              <button
                type="button"
                key={employee.id}
                onClick={() => onSelect?.(employee)}
                className={`card selectable p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#b26c59] bg-[#b26c59]/5 ring-2 ring-[#b26c59]/20 shadow-sm'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      {employee.avatarUrl ? (
                        <img
                          className="w-12 h-12 rounded-full object-cover border border-stone-200"
                          src={employee.avatarUrl}
                          alt={employee.displayName}
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-xs"
                          style={{ backgroundColor: employee.colorHex || '#b26c59' }}
                        >
                          {employee.displayName.slice(0, 2).toUpperCase() || <User className="w-5 h-5" />}
                        </div>
                      )}
                      <div>
                        <strong className="block text-stone-900 font-medium">
                          {employee.displayName}
                        </strong>
                        <span className="text-xs text-stone-500">
                          {employee.roleTitle || 'Nail Artist'}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="p-1 rounded-full bg-[#b26c59] text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  {employee.bio && (
                    <p className="text-xs text-stone-600 line-clamp-2 mb-2 leading-relaxed">
                      {employee.bio}
                    </p>
                  )}

                  {employee.skillTags && employee.skillTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {employee.skillTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Display selected service name and duration on employee cards */}
                {selectedService && (
                  <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-600 inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#b26c59]" />
                      {selectedService.name}
                    </span>
                    <span className="font-medium text-stone-700">
                      {selectedService.durationMinutes} min
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export const NailistPicker = NailistsShowcase
