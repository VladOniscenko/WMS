import { useEffect, useRef, useState } from 'react'
import { authApi, type AuthUser } from './index'
import { useAuth } from '@shared/auth/AuthProvider'

type Props = { onAuthenticated?: (user: AuthUser) => void; onClose?: () => void }

export function PasswordlessLoginForm({ onAuthenticated, onClose }: Props) {
  const { setSession } = useAuth()
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [sent, setSent] = useState(false)
  const [seconds, setSeconds] = useState(600)
  const [error, setError] = useState('')
  const refs = useRef<Array<HTMLInputElement | null>>([])
  useEffect(() => {
    if (!sent || seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [sent, seconds])
  async function sendCode() {
    setError('')
    try { await authApi.requestCode(email, 'customer'); setSent(true); setSeconds(600) }
    catch { setError('We could not send a code. Check the email address and try again.') }
  }
  async function verify() {
    setError('')
    try {
      const response = await authApi.verifyCode(email, digits.join(''))
      setSession(response.accessToken, response.user)
      onAuthenticated?.(response.user)
      onClose?.()
    } catch { setError('That code is invalid or expired.') }
  }
  return <div className="card">
    <h2>{sent ? 'Enter your login code' : 'Sign in to book'}</h2>
    {!sent ? <form onSubmit={(event) => { event.preventDefault(); void sendCode() }}>
      <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button type="submit">Send Login Code</button>
    </form> : <form onSubmit={(event) => { event.preventDefault(); void verify() }}>
      <p>Code sent to {email}. Expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}.</p>
      <div className="otp">
        {digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element }} inputMode="numeric" maxLength={1} value={digit} aria-label={`Digit ${index + 1}`} onPaste={(event) => {
          event.preventDefault()
          const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
          setDigits([...pasted, ...Array(6 - pasted.length).fill('')])
          refs.current[Math.min(pasted.length, 5)]?.focus()
        }} onChange={(event) => {
          const next = [...digits]; next[index] = event.target.value.replace(/\D/g, '')
          setDigits(next); if (event.target.value && index < 5) refs.current[index + 1]?.focus()
        }} />)}
      </div>
      <button type="submit" disabled={digits.join('').length !== 6}>Verify & Continue</button>
      <button type="button" onClick={() => setSent(false)}>Use a different email</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </div>
}

export function PasswordlessLoginModal({ onAuthenticated, onClose }: Props) {
  return <div className="modal" role="dialog" aria-modal="true"><PasswordlessLoginForm onAuthenticated={onAuthenticated} onClose={onClose} /></div>
}
