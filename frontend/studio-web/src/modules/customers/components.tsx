import { useState, type FormEvent } from 'react'
import { customersApi } from './index'

export function CustomerProfileDrawer() {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', notes: '' })
  const [message, setMessage] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    await customersApi.updateMe(form)
    setMessage('Profile saved.')
  }
  return <form className="card" onSubmit={(event) => void save(event)}><h2>Your profile</h2>{Object.keys(form).map((field) => <label key={field}>{field}<input value={form[field as keyof typeof form]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}<button type="submit">Save profile</button>{message && <p role="status">{message}</p>}</form>
}
