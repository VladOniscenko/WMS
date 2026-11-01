import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  ArrowRight,
  PartyPopper,
  Building2,
  Globe,
  UserCheck,
  Clock,
  Scissors,
  FileText,
  UploadCloud,
} from 'lucide-react'
import {
  useBusinesses,
  usePages,
  usePublishWebsite,
  useEmployees,
  type Website,
} from '@shared/queries'
import { employeesApi } from '@modules/employees'
import { catalogApi } from '@modules/cms'
import { useToast } from '@shared/ui/Toast'

interface GettingStartedCardProps {
  website?: Website
  websiteId?: string
}

export function GettingStartedCard({
  website,
  websiteId,
}: GettingStartedCardProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const publishMutation = usePublishWebsite()
  const [publishing, setPublishing] = useState(false)

  // 1. Businesses
  const { data: businesses = [] } = useBusinesses()
  const isBusinessCreated = businesses.length > 0

  // Target website resolution
  const allWebsites = businesses.flatMap((b) => b.websites)
  const targetWebsite =
    website ||
    (websiteId ? allWebsites.find((w) => w.id === websiteId) : allWebsites[0])
  const isWebsiteCreated = Boolean(targetWebsite)
  const currentWebsiteId = targetWebsite?.id || ''

  // 3. Employees
  const { data: employees = [] } = useEmployees()
  const isEmployeeAdded = employees.length > 0

  // 4. Availability / Schedules
  const { data: schedules = [] } = useQuery({
    queryKey: ['employeeSchedules', currentWebsiteId],
    queryFn: async () => {
      try {
        const { data } = await employeesApi.listSchedules()
        return Array.isArray(data) ? data : []
      } catch {
        return []
      }
    },
    enabled: isBusinessCreated,
  })
  const isAvailabilitySet = schedules.length > 0

  // 5. Services
  const { data: services = [] } = useQuery({
    queryKey: ['catalogServices', currentWebsiteId],
    queryFn: async () => {
      try {
        const { data } = await catalogApi.list(currentWebsiteId)
        return data || []
      } catch {
        return []
      }
    },
    enabled: Boolean(currentWebsiteId),
  })
  const isServiceCreated = services.length > 0

  // 6. Home page
  const { data: pages = [] } = usePages(currentWebsiteId)
  const isHomePageBuilt = pages.some(
    (p) => p.slug === 'home' || p.slug.toLowerCase() === 'home'
  )

  // 7. Website published
  const isWebsitePublished = targetWebsite?.status === 'Published'

  const items = [
    {
      id: 'business',
      label: 'Create your business',
      description: 'Set up your studio name and owner identity.',
      icon: Building2,
      checked: isBusinessCreated,
      ctaLabel: 'Business info',
      action: () => navigate('/manage/settings'),
    },
    {
      id: 'website',
      label: 'Create your first website',
      description: 'Establish your brand presence and custom URL slug.',
      icon: Globe,
      checked: isWebsiteCreated,
      ctaLabel: 'New website',
      action: () => navigate('/manage/websites/new'),
    },
    {
      id: 'employee',
      label: 'Add at least one employee',
      description: 'Introduce your specialists so customers know who they book with.',
      icon: UserCheck,
      checked: isEmployeeAdded,
      ctaLabel: 'Add employee',
      action: () => {
        if (currentWebsiteId) {
          navigate(`/manage/websites/${currentWebsiteId}/employees`)
        } else {
          navigate('/manage/websites/new')
        }
      },
    },
    {
      id: 'availability',
      label: 'Set employee availability',
      description: 'Configure working hours and weekly appointment windows.',
      icon: Clock,
      checked: isAvailabilitySet,
      ctaLabel: 'Set availability',
      action: () => {
        if (currentWebsiteId) {
          navigate(`/manage/websites/${currentWebsiteId}/employees`)
        } else {
          navigate('/manage/websites/new')
        }
      },
    },
    {
      id: 'service',
      label: 'Create at least one service',
      description: 'List treatments, pricing, and duration for online reservations.',
      icon: Scissors,
      checked: isServiceCreated,
      ctaLabel: 'Add service',
      action: () => {
        if (currentWebsiteId) {
          navigate(`/manage/websites/${currentWebsiteId}/services`)
        } else {
          navigate('/manage/websites/new')
        }
      },
    },
    {
      id: 'homepage',
      label: 'Build your home page',
      description: 'Design your visual hero banner, story, and navigation sections.',
      icon: FileText,
      checked: isHomePageBuilt,
      ctaLabel: 'Edit page',
      action: () => {
        if (currentWebsiteId) {
          navigate(`/manage/websites/${currentWebsiteId}/pages`)
        } else {
          navigate('/manage/websites/new')
        }
      },
    },
    {
      id: 'publish',
      label: 'Publish your website',
      description: 'Launch your website live so customers can browse and book.',
      icon: UploadCloud,
      checked: isWebsitePublished,
      ctaLabel: isWebsitePublished ? 'Published' : 'Publish now',
      action: async () => {
        if (!currentWebsiteId) {
          navigate('/manage/websites/new')
          return
        }
        if (isWebsitePublished) {
          return
        }
        setPublishing(true)
        try {
          await publishMutation.mutateAsync(currentWebsiteId)
          toast.success('Your website is now published and live!')
        } catch {
          toast.error('Failed to publish website. Please try again.')
        } finally {
          setPublishing(false)
        }
      },
    },
  ]

  const completedCount = items.filter((i) => i.checked).length
  const allCompleted = items.every((i) => i.checked)

  // Celebratory card when all items are checked
  if (allCompleted && targetWebsite) {
    return (
      <section className="mb-8 p-7 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-stone-50 to-white shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <PartyPopper className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow text-emerald-800 m-0">Live & Open</p>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Ready for bookings
                </span>
              </div>
              <h3 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                Your site is live!
              </h3>
              <p className="text-xs text-stone-600 mt-1 max-w-xl">
                Congratulations! All 7 getting started milestones are fulfilled. Your digital studio
                is fully configured and open for clients.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <a
              href={`/sites/${targetWebsite.domainOrSlug}`}
              target="_blank"
              rel="noreferrer"
              className="button primary inline-flex items-center gap-1.5 text-xs py-2.5 px-4 cursor-pointer"
            >
              <span>Visit live site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Link
              to={`/manage/websites/${targetWebsite.id}/pages`}
              className="button secondary text-xs py-2.5 px-4 inline-flex items-center gap-1.5"
            >
              <span>Manage pages</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8 p-6 sm:p-7 rounded-2xl border border-stone-200 bg-white shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow text-[#b26c59] m-0">Setup Guide</p>
            <span className="text-[11px] font-semibold text-stone-500">
              {completedCount} of {items.length} completed
            </span>
          </div>
          <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
            Getting Started with your Studio
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Follow these essential steps to get your website ready for online appointments.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full sm:w-44 flex flex-col gap-1.5">
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-[#b26c59] transition-all duration-300 rounded-full"
              style={{ width: `${(completedCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-right font-medium text-stone-500">
            {Math.round((completedCount / items.length) * 100)}% complete
          </span>
        </div>
      </div>

      {/* Checklist items list */}
      <div className="divide-y divide-stone-100 mt-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.id}
              className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors rounded-lg px-2 -mx-2 ${
                item.checked ? 'bg-stone-50/40 opacity-75' : 'hover:bg-stone-50/80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {item.checked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-stone-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-stone-400" />
                    <span
                      className={`text-sm font-semibold ${
                        item.checked
                          ? 'text-stone-700 line-through decoration-stone-300'
                          : 'text-stone-900'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{item.description}</p>
                </div>
              </div>

              <div className="sm:ml-auto shrink-0 pl-8 sm:pl-0">
                {item.checked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void item.action()}
                    disabled={publishing}
                    className="button small primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{item.ctaLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
