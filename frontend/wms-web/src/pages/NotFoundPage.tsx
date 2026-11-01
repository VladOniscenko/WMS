import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#f7f6f3] text-[#242126]">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-7xl font-bold font-serif text-[#b26c59]">404</div>
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-stone-600">
          The page you are looking for doesn't exist, has been removed, or is temporarily unavailable.
        </p>
        <div>
          <Link
            to="/manage"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white bg-[#b26c59] hover:bg-[#8d4e40] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to workspace
          </Link>
        </div>
      </div>
    </main>
  )
}

