export function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    // Handle base64url standard formatting
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    const payload = JSON.parse(jsonPayload)
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

