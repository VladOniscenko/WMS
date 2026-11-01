import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Calendar,
  Layers,
  Users,
  UserCheck,
  ExternalLink,
  Store,
  Globe,
  Palette,
  Boxes,
  PartyPopper,
} from 'lucide-react'
import { httpClient } from '@shared/api/httpClient'
import { useAuth } from '@shared/auth/AuthProvider'
import { useQueryClient } from '@tanstack/react-query'
import { websiteKeys, type Business, type Website } from '@shared/queries'

const STORAGE_KEY = 'wms_onboarding_draft'

const TEMPLATES = [
  {
    id: 'editorial' as const,
    name: 'Editorial Studio',
    tagline: 'Bold typography & editorial poise',
    description: 'Generous serif headings and high-contrast composition for luxury studios.',
    color: '#b77962',
    previewBg: '#fdfbf7',
  },
  {
    id: 'minimal' as const,
    name: 'Minimal Atelier',
    tagline: 'Quiet, calm & service-centered',
    description: 'Clean geometry and ample white space letting your treatments take center stage.',
    color: '#9b8b7a',
    previewBg: '#f8f8f8',
  },
  {
    id: 'playful' as const,
    name: 'Playful Pop',
    tagline: 'Vibrant, warm & expressive',
    description: 'Contemporary rounded aesthetics and lively accents for trendy lifestyle brands.',
    color: '#c26d8b',
    previewBg: '#fff5f7',
  },
]

const MODULE_OPTIONS = [
  {
    id: 'agenda',
    title: 'Agenda & Booking Widget',
    recommended: true,
    icon: Calendar,
    description: 'Enables 24/7 client online appointment scheduling, slot reservation, and availability management.',
  },
  {
    id: 'cms',
    title: 'Service Catalog & Pages',
    recommended: false,
    icon: Layers,
    description: 'Publish customized treatment menus, pricing, duration, and visual gallery sections on your website.',
  },
  {
    id: 'employees',
    title: 'Team & Specialists',
    recommended: false,
    icon: UserCheck,
    description: 'Showcase your nailists and artists with avatars, working hours, and specialist tags.',
  },
  {
    id: 'customers',
    title: 'Customer Management CRM',
    recommended: false,
    icon: Users,
    description: 'Track customer profiles, past appointment histories, and contact preferences.',
  },
]

interface OnboardingDraft {
  step: number
  businessName: string
  businessEmail: string
  businessCategory: string
  websiteName: string
  websiteSlug: string
  websiteCategory: string
  templateId: 'editorial' | 'minimal' | 'playful'
  color: string
  enabledModules: string[]
  createdWebsiteId?: string
  createdWebsiteSlug?: string
}

export function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as OnboardingDraft
      }
    } catch {
      // Fallback to default
    }
    return {
      step: 1,
      businessName: '',
      businessEmail: user?.email || '',
      businessCategory: 'Studio',
      websiteName: '',
      websiteSlug: '',
      websiteCategory: 'Nail studio',
      templateId: 'editorial',
      color: '#b26c59',
      enabledModules: ['agenda', 'cms', 'employees', 'customers'],
    }
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Sync draft to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // Ignore storage errors
    }
  }, [draft])

  // Fire confetti when reaching step 5
  useEffect(() => {
    if (draft.step === 5) {
      void confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }, [draft.step])

  const sanitizeSlug = (val: string) =>
    val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

  const updateDraft = (updates: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }))
    setErrorMessage(null)
  }

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.businessName.trim()) {
      setErrorMessage('Please enter your business name.')
      return
    }
    // Auto populate website name and slug if empty
    const nextUpdates: Partial<OnboardingDraft> = { step: 2 }
    if (!draft.websiteName) {
      nextUpdates.websiteName = draft.businessName
    }
    if (!draft.websiteSlug) {
      nextUpdates.websiteSlug = sanitizeSlug(draft.businessName)
    }
    updateDraft(nextUpdates)
  }

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.websiteName.trim()) {
      setErrorMessage('Please enter a website name.')
      return
    }
    const cleanSlug = sanitizeSlug(draft.websiteSlug)
    if (!cleanSlug) {
      setErrorMessage('Please enter a valid URL slug.')
      return
    }
    updateDraft({ step: 3, websiteSlug: cleanSlug })
  }

  const handleNextStep3 = () => {
    updateDraft({ step: 4 })
  }

  const handleFinishWizard = async () => {
    if (draft.enabledModules.length === 0) {
      setErrorMessage('Please enable at least one module (Agenda is recommended).')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      // Step A: Create or ensure business exists
      let businessId = ''
      const email = draft.businessEmail || user?.email || ''
      try {
        const { data: businesses } = await httpClient.get<Business[]>('/api/businesses')
        if (businesses.length > 0) {
          businessId = businesses[0].id
        }
      } catch {
        // Business check fallback
      }

      if (!businessId) {
        const { data: newBiz } = await httpClient.post<Business>('/api/businesses', {
          name: draft.businessName,
          ownerEmail: email,
          subscriptionTier: 'Free',
        })
        businessId = newBiz.id
      }

      // Step B: Create website under the business
      const websitePayload = {
        name: draft.websiteName,
        domainOrSlug: draft.websiteSlug,
        templateId: draft.templateId,
        category: draft.websiteCategory || draft.businessCategory,
        enabledModules: draft.enabledModules,
        themeConfig: {
          primaryColor: draft.color,
          themeId: draft.templateId,
        },
        content: {
          title: draft.websiteName,
          heroText: `Welcome to ${draft.websiteName}. Thoughtfully created for our clients.`,
        },
      }

      const { data: createdSite } = await httpClient.post<Website>(
        `/api/businesses/${businessId}/websites`,
        websitePayload
      )

      // Set active studio tenant in localStorage
      try {
        localStorage.setItem(
          'studio-tenant',
          JSON.stringify({
            businessId,
            websiteId: createdSite.id,
          })
        )
      } catch {
        // Ignore storage errors
      }

      // Invalidate react-query cache
      void queryClient.invalidateQueries({ queryKey: websiteKeys.businesses })
      void queryClient.invalidateQueries({ queryKey: websiteKeys.all })

      // Advance to step 5 (Done)
      updateDraft({
        step: 5,
        createdWebsiteId: createdSite.id,
        createdWebsiteSlug: createdSite.domainOrSlug,
      })

      // Clean draft from localStorage now that it's complete
      localStorage.removeItem(STORAGE_KEY)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create your website. Please check the slug availability and details.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { num: 1, label: 'Business info', icon: Store },
    { num: 2, label: 'Website setup', icon: Globe },
    { num: 3, label: 'Template', icon: Palette },
    { num: 4, label: 'First module', icon: Boxes },
    { num: 5, label: 'Ready!', icon: PartyPopper },
  ]

  const liveUrl = `${window.location.origin}/sites/${draft.websiteSlug || 'your-slug'}`

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between text-stone-800">
      {/* Top Header */}
      <header className="px-6 py-4 bg-white border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="brand-mark">W</span>
          <span className="font-bold text-lg text-stone-900 tracking-tight">WMS Onboarding</span>
        </div>
        <div className="text-xs text-stone-500">
          Signed in as <strong className="text-stone-700">{user?.email}</strong>
        </div>
      </header>

      {/* Main Wizard Area */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="mb-8" aria-label="Onboarding Progress">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-stone-200 w-full -z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#b26c59] transition-all duration-300 -z-0"
              style={{ width: `${((draft.step - 1) / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((s) => {
              const isPast = draft.step > s.num
              const isCurrent = draft.step === s.num
              return (
                <div key={s.num} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      isPast
                        ? 'bg-[#b26c59] text-white'
                        : isCurrent
                          ? 'bg-[#242126] text-white ring-4 ring-[#e0a68d]/40'
                          : 'bg-white text-stone-400 border border-stone-300'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium mt-1.5 hidden sm:block ${
                      isCurrent ? 'text-stone-900 font-bold' : 'text-stone-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Wizard Card Body */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {errorMessage}
            </div>
          )}

          {/* STEP 1: Business info */}
          {draft.step === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-6">
              <div>
                <p className="eyebrow text-[#b26c59]">Step 1 of 5</p>
                <h1 className="text-2xl font-serif font-bold text-stone-900">
                  Tell us about your business
                </h1>
                <p className="text-sm text-stone-500 mt-1">
                  We will create your business account and set up the default workspace.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Business name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.businessName}
                    onChange={(e) => updateDraft({ businessName: e.target.value })}
                    placeholder="e.g. Atelier Éclat, Glow Studio"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Owner email
                  </label>
                  <input
                    type="email"
                    required
                    value={draft.businessEmail}
                    onChange={(e) => updateDraft({ businessEmail: e.target.value })}
                    placeholder="contact@business.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-2">
                    Business category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['Salon', 'Studio', 'Spa', 'Other'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => updateDraft({ businessCategory: cat })}
                        className={`p-3 rounded-xl border text-sm font-medium text-center transition-all cursor-pointer ${
                          draft.businessCategory === cat
                            ? 'border-[#b26c59] bg-[#b26c59]/10 text-[#8d4e40] font-bold shadow-xs'
                            : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100 text-stone-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="button primary inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Website</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Website setup */}
          {draft.step === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-6">
              <div>
                <p className="eyebrow text-[#b26c59]">Step 2 of 5</p>
                <h1 className="text-2xl font-serif font-bold text-stone-900">
                  Set up your website address
                </h1>
                <p className="text-sm text-stone-500 mt-1">
                  Choose the public name and slug where clients will browse your treatments.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Website public name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.websiteName}
                    onChange={(e) => updateDraft({ websiteName: e.target.value })}
                    placeholder="e.g. Atelier Éclat Amsterdam"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    URL slug <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.websiteSlug}
                    onChange={(e) => updateDraft({ websiteSlug: sanitizeSlug(e.target.value) })}
                    placeholder="atelier-eclat"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                  />
                </div>

                {/* Live URL Preview Card */}
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <p className="text-xs font-semibold text-stone-600 mb-1">
                    Live URL preview:
                  </p>
                  <div className="flex items-center gap-2 text-sm text-[#b26c59] font-mono break-all font-medium">
                    <Globe className="w-4 h-4 shrink-0 text-stone-400" />
                    <span>{liveUrl}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Website category
                  </label>
                  <input
                    type="text"
                    value={draft.websiteCategory}
                    onChange={(e) => updateDraft({ websiteCategory: e.target.value })}
                    placeholder="e.g. Nail studio, Skin aesthetics"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b26c59]/20 focus:border-[#b26c59]"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => updateDraft({ step: 1 })}
                  className="button secondary inline-flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="button primary inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Choose Template</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Template selection */}
          {draft.step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="eyebrow text-[#b26c59]">Step 3 of 5</p>
                <h1 className="text-2xl font-serif font-bold text-stone-900">
                  Choose a visual aesthetic
                </h1>
                <p className="text-sm text-stone-500 mt-1">
                  Pick a curated template that reflects the personality of your brand.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TEMPLATES.map((tmpl) => {
                  const isSelected = draft.templateId === tmpl.id
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => updateDraft({ templateId: tmpl.id, color: tmpl.color })}
                      className={`rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#b26c59] bg-[#b26c59]/5 shadow-md'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div>
                        {/* Art mockup */}
                        <div
                          className="h-28 rounded-lg mb-3 flex flex-col items-center justify-center p-3 text-white text-center shadow-xs"
                          style={{ background: tmpl.color }}
                        >
                          <Sparkles className="w-6 h-6 mb-1 opacity-90" />
                          <span className="text-xs font-serif font-bold tracking-wide">
                            {tmpl.name}
                          </span>
                        </div>

                        <h3 className="font-bold text-stone-900 text-sm">{tmpl.name}</h3>
                        <p className="text-xs text-stone-500 mt-0.5 italic">{tmpl.tagline}</p>
                        <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                          {tmpl.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500">Theme</span>
                        {isSelected ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-[#b26c59]">
                            <Check className="w-3.5 h-3.5" /> Selected
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">Select</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Color Customizer */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-800">Primary brand color</p>
                  <p className="text-[11px] text-stone-500">
                    Used for buttons, badges, and primary accents.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full border border-stone-300 shadow-xs"
                    style={{ background: draft.color }}
                  />
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => updateDraft({ color: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded border border-stone-300"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => updateDraft({ step: 2 })}
                  className="button secondary inline-flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep3}
                  className="button primary inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Select Modules</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: First module */}
          {draft.step === 4 && (
            <div className="space-y-6">
              <div>
                <p className="eyebrow text-[#b26c59]">Step 4 of 5</p>
                <h1 className="text-2xl font-serif font-bold text-stone-900">
                  Select your website modules
                </h1>
                <p className="text-sm text-stone-500 mt-1">
                  Modules give your site functionality. Enable at least one module below (Agenda
                  booking is recommended so clients can book appointments online).
                </p>
              </div>

              <div className="space-y-3">
                {MODULE_OPTIONS.map((mod) => {
                  const Icon = mod.icon
                  const isChecked = draft.enabledModules.includes(mod.id)
                  return (
                    <label
                      key={mod.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isChecked
                          ? 'border-[#b26c59] bg-[#b26c59]/5'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...draft.enabledModules, mod.id]
                            : draft.enabledModules.filter((m) => m !== mod.id)
                          updateDraft({ enabledModules: updated })
                        }}
                        className="mt-1 h-5 w-5 rounded border-stone-300 text-[#b26c59] focus:ring-[#b26c59]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-[#b26c59]" />
                          <h3 className="text-sm font-bold text-stone-900">{mod.title}</h3>
                          {mod.recommended && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                          {mod.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => updateDraft({ step: 3 })}
                  className="button secondary inline-flex items-center gap-2 cursor-pointer"
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinishWizard()}
                  disabled={isSubmitting || draft.enabledModules.length === 0}
                  className="button primary inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Creating your studio…</span>
                  ) : (
                    <>
                      <span>Launch website</span>
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Done */}
          {draft.step === 5 && (
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <PartyPopper className="w-8 h-8" />
              </div>

              <div>
                <p className="eyebrow text-emerald-700">Congratulations!</p>
                <h1 className="text-3xl font-serif font-bold text-stone-900 mt-1">
                  Your website is ready
                </h1>
                <p className="text-sm text-stone-600 max-w-md mx-auto mt-2">
                  We have configured <strong>{draft.websiteName || 'your website'}</strong> with the{' '}
                  <span className="capitalize font-semibold">{draft.templateId}</span> template and{' '}
                  {draft.enabledModules.length} enabled modules.
                </p>
              </div>

              {/* Quick Link Card */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 max-w-md mx-auto text-left space-y-2">
                <p className="text-xs font-semibold text-stone-600">Public Website URL:</p>
                <a
                  href={`/sites/${draft.createdWebsiteSlug || draft.websiteSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-stone-200 text-sm font-mono text-[#b26c59] hover:bg-stone-50 transition-colors"
                >
                  <span className="truncate">
                    /sites/{draft.createdWebsiteSlug || draft.websiteSlug}
                  </span>
                  <ExternalLink className="w-4 h-4 shrink-0 text-stone-400" />
                </a>
              </div>

              {/* Actions */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                {draft.createdWebsiteId ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/manage/websites/${draft.createdWebsiteId}/pages`)
                    }
                    className="button primary w-full sm:w-auto inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Manage website</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/manage/websites')}
                    className="button primary w-full sm:w-auto cursor-pointer"
                  >
                    View all websites
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/manage')}
                  className="button secondary w-full sm:w-auto cursor-pointer"
                >
                  Go to workspace overview
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-stone-400 border-t border-stone-200 bg-white">
        WMS Studio Platform · Designed for calm digital craftsmanship
      </footer>
    </div>
  )
}

