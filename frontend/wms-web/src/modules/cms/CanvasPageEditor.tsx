import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { httpClient } from '@shared/api/httpClient'

export type CanvasSection = {
  id: string
  type: string
  heading: string
  body?: string
  imageUrl?: string
  sortOrder: number
}
type Page = { id: string; websiteId: string; title: string; slug: string; status: string; sections: CanvasSection[] }

const blockTypes = [
  ['hero', 'Hero', 'Large introduction with a call to action'],
  ['text', 'Rich text', 'Heading and formatted story content'],
  ['image', 'Image', 'A full-width visual block'],
  ['gallery', 'Gallery', 'A grid of brand imagery'],
  ['services', 'Services', 'Your service catalogue'],
  ['employees', 'Nailists', 'Meet your team'],
  ['booking', 'Booking', 'Let customers reserve a time'],
  ['testimonials', 'Testimonials', 'Social proof from customers'],
  ['contact', 'Contact', 'Address, opening hours, and contact'],
  ['custom_html', 'Custom HTML', 'Advanced custom content'],
]

export function CanvasPageEditor({ websiteId, websiteName, onBack }: { websiteId: string; websiteName: string; onBack: () => void }) {
  const [pages, setPages] = useState<Page[]>([])
  const [activeId, setActiveId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const active = pages.find(page => page.id === activeId)
  const selected = active?.sections.find(section => section.id === selectedId)
  const [pageTitle, setPageTitle] = useState('')
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [newPage, setNewPage] = useState({ title: '', slug: '' })

  async function load() {
    const response = await httpClient.get<Page[]>(`/api/websites/${websiteId}/pages`)
    setPages(response.data)
    if (response.data[0]) {
      setActiveId(current => current || response.data[0].id)
      setPageTitle(response.data[0].title)
    }
  }
  useEffect(() => { void load() }, [websiteId])

  async function save(next: Page) {
    setSaving(true)
    try {
      const response = await httpClient.put<Page>(`/api/websites/${websiteId}/pages/${next.id}`, next)
      setPages(current => current.map(page => page.id === next.id ? response.data : page))
      setNotice('Saved just now')
    } finally { setSaving(false) }
  }
  async function createPage() {
    const title = newPage.title.trim()
    const slug = newPage.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!title || !slug) return
    const response = await httpClient.post<Page>(`/api/websites/${websiteId}/pages`, { title, slug, status: 'Draft', showInNavigation: true, sections: [] })
    setPages(current => [...current, response.data])
    setActiveId(response.data.id)
    setNewPage({ title: '', slug: '' })
    setNewPageOpen(false)
  }
  async function deletePage(page: Page) {
    if (!window.confirm(`Delete "${page.title}"?`)) return
    await httpClient.delete(`/api/websites/${websiteId}/pages/${page.id}`)
    setPages(current => current.filter(item => item.id !== page.id))
    setActiveId(current => current === page.id ? '' : current)
  }
  function updateSection(patch: Partial<CanvasSection>) {
    if (!active || !selected) return
    const next = { ...active, sections: active.sections.map(section => section.id === selected.id ? { ...section, ...patch } : section) }
    setPages(current => current.map(page => page.id === next.id ? next : page))
  }
  function addBlock(type: string) {
    if (!active) return
    const next: CanvasSection = { id: crypto.randomUUID(), type, heading: blockTypes.find(item => item[0] === type)?.[1] ?? 'New section', body: 'Start writing here…', sortOrder: active.sections.length }
    const page = { ...active, sections: [...active.sections, next] }
    setPages(current => current.map(item => item.id === page.id ? page : item))
    setSelectedId(next.id)
  }
  function moveBlock(index: number, direction: -1 | 1) {
    if (!active) return
    const target = index + direction
    if (target < 0 || target >= active.sections.length) return
    const sections = [...active.sections]
    ;[sections[index], sections[target]] = [sections[target], sections[index]]
    const page = { ...active, sections: sections.map((item, position) => ({ ...item, sortOrder: position })) }
    setPages(current => current.map(item => item.id === page.id ? page : item))
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    const form = new FormData()
    form.append('file', file)
    const response = await httpClient.post<{ url: string }>('/api/assets', form)
    updateSection({ imageUrl: response.data.url })
  }
  const previewStyle = useMemo(() => ({ background: selected?.type === 'hero' ? 'linear-gradient(135deg,#3b2931,#b06a59)' : '#fff' }), [selected?.type])
  if (!active) return <section className="editor-empty"><h2>Start your first page</h2><p>Every website begins with a page. Add one, then build it visually.</p><button className="button primary" onClick={async () => { const response = await httpClient.post<Page>(`/api/websites/${websiteId}/pages`, { title: 'Home', slug: 'home', status: 'Draft', showInNavigation: true, sections: [] }); setPages([response.data]); setActiveId(response.data.id) }}>Create home page</button></section>
  return <section className="canvas-editor"><header className="editor-toolbar"><button className="button secondary" onClick={onBack}>← Websites</button><div><p className="eyebrow">{websiteName}</p><strong>{pageTitle || active.title}</strong></div><span className="save-state">{saving ? 'Saving…' : notice || 'All changes saved'}</span><button className="button secondary" onClick={() => setNewPageOpen(true)}>＋ New page</button><button className="button secondary" onClick={() => void save(active)}>Save draft</button><button className="button primary" onClick={() => void save({ ...active, status: active.status === 'Published' ? 'Draft' : 'Published' })}>{active.status === 'Published' ? 'Unpublish' : 'Publish'}</button></header>{newPageOpen && <div className="inline-dialog"><input autoFocus placeholder="Page title" value={newPage.title} onChange={event => setNewPage({ ...newPage, title: event.target.value })} /><input placeholder="URL slug" value={newPage.slug} onChange={event => setNewPage({ ...newPage, slug: event.target.value })} /><button className="button primary" onClick={() => void createPage()}>Create page</button><button className="button secondary" onClick={() => setNewPageOpen(false)}>Cancel</button></div>}<div className="canvas-layout"><aside className="block-library"><p className="eyebrow">Pages</p><div className="page-list">{pages.map(page => <div className={`page-list-item ${page.id === active.id ? 'active' : ''}`} key={page.id}><button onClick={() => { setActiveId(page.id); setPageTitle(page.title); setSelectedId('') }}>{page.title}<small>/{page.slug}</small></button><button aria-label={`Delete ${page.title}`} onClick={() => void deletePage(page)}>×</button></div>)}</div><p className="eyebrow">Add to page</p>{blockTypes.map(([type, label, description]) => <button className="block-option" key={type} onClick={() => addBlock(type)}><span className="block-icon">＋</span><span><strong>{label}</strong><small>{description}</small></span></button>)}</aside><main className="page-canvas"><div className="canvas-device"><div className="canvas-site-header"><strong>{websiteName}</strong><span>Home · Services · Contact</span></div>{active.sections.length === 0 && <div className="canvas-placeholder"><span>✦</span><h2>Your page is empty</h2><p>Choose a block from the left to start designing.</p></div>}{active.sections.map((section, index) => <article key={section.id} className={`canvas-block ${selectedId === section.id ? 'selected' : ''}`} style={section.type === 'hero' ? previewStyle : undefined} onClick={() => setSelectedId(section.id)}><span className="block-label">{section.type.replace('_', ' ')}</span><h2>{section.heading}</h2><p>{section.body}</p>{section.imageUrl && <img src={section.imageUrl} alt="" />}{selectedId === section.id && <div className="block-actions"><button onClick={event => { event.stopPropagation(); moveBlock(index, -1) }}>↑</button><button onClick={event => { event.stopPropagation(); moveBlock(index, 1) }}>↓</button><button onClick={event => { event.stopPropagation(); const copy = { ...section, id: crypto.randomUUID(), heading: `${section.heading} copy`, sortOrder: active.sections.length }; setPages(current => current.map(page => page.id === active.id ? { ...page, sections: [...page.sections, copy] } : page)) }}>Duplicate</button><button onClick={event => { event.stopPropagation(); setPages(current => current.map(page => page.id === active.id ? { ...page, sections: page.sections.filter(item => item.id !== section.id) } : page)); setSelectedId('') }}>Delete</button></div>}</article>)}</div></main><aside className="block-inspector"><p className="eyebrow">Inspector</p>{selected ? <><h3>{selected.heading}</h3><label>Block type<select value={selected.type} onChange={event => updateSection({ type: event.target.value })}>{blockTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label>Heading<input value={selected.heading} onChange={event => updateSection({ heading: event.target.value })} /></label><label>Content<textarea rows={7} value={selected.body ?? ''} onChange={event => updateSection({ body: event.target.value })} /></label><label>Image<input type="file" accept="image/*" onChange={event => void upload(event)} /></label>{selected.imageUrl && <img className="inspector-image" src={selected.imageUrl} alt="" />}</> : <div className="inspector-empty"><span>↖</span><p>Select a block on the canvas to edit its content, imagery, and layout.</p></div>}</aside></div></section>
}
