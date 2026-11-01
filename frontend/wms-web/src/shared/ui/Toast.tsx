import { createContext, useContext, useCallback, useState, useMemo, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const resolvedDuration = duration ?? (type === 'error' ? 8000 : 4000)

      const newToast: ToastItem = {
        id,
        message,
        type,
        duration: resolvedDuration,
      }

      setToasts((prev) => [...prev, newToast])

      if (resolvedDuration > 0) {
        window.setTimeout(() => {
          dismiss(id)
        }, resolvedDuration)
      }
    },
    [dismiss],
  )

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast],
  )
  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast],
  )
  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast],
  )
  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast],
  )

  const value = useMemo(
    () => ({
      toasts,
      showToast,
      success,
      error,
      info,
      warning,
      dismiss,
    }),
    [toasts, showToast, success, error, info, warning, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  )
}

const variantStyles: Record<
  ToastType,
  { bg: string; border: string; text: string; icon: typeof CheckCircle2 }
> = {
  success: {
    bg: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  error: {
    bg: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
    border: 'border-rose-200 dark:border-rose-800',
    text: 'text-rose-600 dark:text-rose-400',
    icon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-stone-900 text-stone-100',
    border: 'border-stone-800',
    text: 'text-stone-300',
    icon: Info,
  },
}

function ToastMessage({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  const variant = variantStyles[toast.type]
  const IconComponent = variant.icon

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${variant.bg} ${variant.border}`}
    >
      <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${variant.text}`} />
      <div className="flex-1 text-sm font-medium leading-snug">{toast.message}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 -mr-1 -mt-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-stone-400"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

