import { useMemo, useState } from 'react'
import { AuthContext } from './auth-context'

const STORAGE_KEY = 'iatech.session'

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      login(user, token) {
        const next = { user, token }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setSession(next)
      },
      logout() {
        localStorage.removeItem(STORAGE_KEY)
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
