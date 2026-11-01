import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TenantProvider } from './shared/tenancy/TenantProvider'
import { AuthProvider } from './shared/auth/AuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantProvider><AuthProvider><App /></AuthProvider></TenantProvider>
  </StrictMode>,
)
