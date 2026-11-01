import { useEffect, useState } from 'react'
import { httpClient } from '@shared/api/httpClient'

type Section = { id: string; type: string; heading: string; body?: string; imageUrl?: string }
type Page = { title: string; sections: Section[] }

export function PublicPageRenderer({ slug, pageSlug = 'home' }: { slug: string; pageSlug?: string }) {
  const [page, setPage] = useState<Page | null>(null)
  useEffect(() => {
    void httpClient.get<{ page: Page }>(`/api/websites/resolve/${encodeURIComponent(slug)}/${encodeURIComponent(pageSlug)}`)
      .then(response => setPage(response.data.page))
      .catch(() => setPage(null))
  }, [slug, pageSlug])
  if (!page) return <p className="public-loading">Loading page…</p>
  return <>{page.sections.map(section => <section className={`public-section public-${section.type}`} key={section.id}>{section.imageUrl && <img src={section.imageUrl} alt="" />}{section.type === 'hero' ? <><p className="public-kicker">Welcome</p><h2>{section.heading}</h2><p>{section.body}</p></> : <><h2>{section.heading}</h2><p>{section.body}</p></>}</section>)}</>
}
