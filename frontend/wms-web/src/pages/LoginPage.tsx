import { useLocation, useNavigate } from 'react-router-dom'
import { PasswordlessLoginForm } from '@modules/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/manage'

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#f7f6f3]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-[#e0a68d] text-[#242126] font-serif text-2xl font-bold">
            W
          </div>
          <span className="text-2xl font-bold tracking-wider text-[#242126]">WMS</span>
        </div>
        <PasswordlessLoginForm
          scope="business-admin"
          onAuthenticated={() => {
            navigate(from, { replace: true })
          }}
        />
      </div>
    </main>
  )
}

