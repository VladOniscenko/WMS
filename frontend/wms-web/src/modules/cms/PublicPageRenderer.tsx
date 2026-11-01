import { useEffect, useState } from 'react'
import { httpClient } from '@shared/api/httpClient'

type Section = { id: string; type: string; heading: string; body?: string; imageUrl?: string }
type Page = { title: string; sections: Section[] }
type WebsiteContent = { navigation?: { brandLabel?: string; items?: { label: string; pageSlug: string }[]; showBookingButton?: boolean }; footer?: { text?: string; address?: string; email?: string; phone?: string } }

export function PublicPageRenderer({ slug, pageSlug = 'home' }: { slug: string; pageSlug?: string }) {
  const [resolved, setResolved] = useState<{ page: Page; content?: WebsiteContent } | null>(null)
  useEffect(() => {
    void httpClient.get<{ page: Page; content?: WebsiteContent }>(`/api/websites/resolve/${encodeURIComponent(slug)}/${encodeURIComponent(pageSlug)}`)
      .then(response => setResolved(response.data))
      .catch(() => setResolved(null))
  }, [slug, pageSlug])
  if (!resolved) return <p className="public-loading">Loading page…</p>
  return <>{resolved.page.sections.map(section => <section className={`public-section public-${section.type}`} key={section.id}>{section.imageUrl && <img src={section.imageUrl} alt="" />}{section.type === 'hero' ? <><p className="public-kicker">Welcome</p><h2>{section.heading}</h2><p>{section.body}</p></> : <><h2>{section.heading}</h2><p>{section.body}</p></>}</section>)}<footer className="public-footer"><strong>{resolved.content?.footer?.text}</strong><span>{resolved.content?.footer?.address}</span><span>{resolved.content?.footer?.email}</span><span>{resolved.content?.footer?.phone}</span></footer></>
}
