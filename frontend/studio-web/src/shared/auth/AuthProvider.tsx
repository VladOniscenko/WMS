import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import type { AuthUser } from '@modules/auth'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  setSession: (token: string, user: AuthUser) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('studio-user')
    return stored ? JSON.parse(stored) as AuthUser : null
  })
  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null && localStorage.getItem('studio-access-token') !== null,
    setSession: (token, nextUser) => {
      localStorage.setItem('studio-access-token', token)
      localStorage.setItem('studio-user', JSON.stringify(nextUser))
      setUser(nextUser)
    },
    signOut: () => {
      localStorage.removeItem('studio-access-token')
      localStorage.removeItem('studio-user')
      setUser(null)
    },
  }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
