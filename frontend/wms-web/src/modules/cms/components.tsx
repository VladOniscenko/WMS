import { useEffect, useState } from 'react'
import { catalogApi, type CatalogService } from './index'

export function ServiceCatalogList({ onSelect }: { onSelect?: (service: CatalogService) => void }) {
  const [services, setServices] = useState<CatalogService[]>([])
  useEffect(() => {
    let active = true
    void catalogApi.list().then(({ data }) => {
      if (active) setServices(data.filter((service) => service.isActive))
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="service-catalog-section my-8">
      <h2 className="text-xl md:text-2xl font-serif font-semibold text-stone-900 mb-4">
        Our services
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {services.map((service) => (
          <button
            type="button"
            className="card selectable p-4 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-xs transition-all text-left cursor-pointer flex flex-col justify-between"
            key={service.id}
            onClick={() => onSelect?.(service)}
          >
            <div>
              <strong className="block text-stone-900 font-medium">{service.name}</strong>
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">{service.description}</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-800">
                {service.price} {service.currency}
              </span>
              <span className="text-stone-500">{service.durationMinutes} min</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
