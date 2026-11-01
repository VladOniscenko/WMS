import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  resetErrorBoundary = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.resetErrorBoundary)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[320px] flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-2xl border border-rose-200 bg-rose-50/50 text-stone-900 shadow-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900">Something went wrong</h3>
            <p className="mt-2 text-sm text-stone-600">
              {this.state.error.message || 'An unexpected error occurred while rendering this view.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.resetErrorBoundary}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

