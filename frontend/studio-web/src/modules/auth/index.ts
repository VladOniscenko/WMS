import { httpClient } from '@shared/api/httpClient'
export { PasswordlessLoginForm, PasswordlessLoginModal } from './components'
export type AuthUser = { id: string; email: string; roles: string[] }
export type AuthResponse = { accessToken: string; expiresAt: string; user: AuthUser }
export const authApi = {
  requestCode: (email: string, scope: 'customer' | 'employee') => httpClient.post('/api/auth/request-code', { email, scope }),
  verifyCode: async (email: string, code: string) => {
    const { data } = await httpClient.post<AuthResponse>('/api/auth/verify-code', { email, code })
    localStorage.setItem('studio-access-token', data.accessToken)
    return data
  },
  me: () => httpClient.get<AuthUser>('/api/auth/me'),
  signOut: () => localStorage.removeItem('studio-access-token'),
}
