import { useEffect, useState } from 'react'
import { cmsApi, type CatalogService, type CmsPageSection } from './index'

export function HeroSection() {
  const [section, setSection] = useState<CmsPageSection | null>(null)
  useEffect(() => { void cmsApi.page('home').then(({ data }) => setSection(data.find((item) => item.sectionKey === 'hero') ?? null)) }, [])
  if (!section) return null
  let content: { title?: string; text?: string } = {}
  try { content = JSON.parse(section.contentJson) as typeof content } catch { /* malformed CMS content is rendered as empty */ }
  return <section className="hero-section"><h1>{content.title ?? 'Welcome to our studio'}</h1><p>{content.text}</p></section>
}

export function ServiceCatalogList({ onSelect }: { onSelect?: (service: CatalogService) => void }) {
  const [services, setServices] = useState<CatalogService[]>([])
  useEffect(() => { void cmsApi.services().then(({ data }) => setServices(data.filter((service) => service.isActive))) }, [])
  return <section><h2>Our services</h2><div className="grid">{services.map((service) => <button className="card selectable" key={service.id} onClick={() => onSelect?.(service)}><strong>{service.name}</strong><span>{service.durationMinutes} min · {service.price} {service.currency}</span><small>{service.description}</small></button>)}</div></section>
}
