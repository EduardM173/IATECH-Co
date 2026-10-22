import { getAreaHost, getAreaRoute } from './areas'
import { createTransfer } from './api'

const configuredRoot = (import.meta.env.VITE_TENANT_ROOT_DOMAIN ?? '').trim().toLowerCase()

export function tenantRoot() {
  if (configuredRoot) return configuredRoot
  return window.location.hostname === 'localhost' || window.location.hostname.endsWith('.localhost')
    ? 'localhost'
    : ''
}

export function currentTenant() {
  const root = tenantRoot()
  if (window.location.origin === centralOrigin()) return null
  if (!root || !window.location.hostname.endsWith('.' + root)) return null
  return window.location.hostname.slice(0, -(root.length + 1))
}

export function centralOrigin() {
  const configured = (import.meta.env.VITE_CENTRAL_ORIGIN ?? '').trim()
  if (configured) return new URL(configured).origin
  const root = tenantRoot()
  if (!root) return window.location.origin
  const url = new URL(window.location.href)
  url.hostname = root
  return url.origin
}

export function areaOrigin(area) {
  const root = tenantRoot()
  if (!root) return window.location.origin
  const url = new URL(centralOrigin())
  url.hostname = `${area}.${root}`
  return url.origin
}

export function safeAreaDestination(value, category) {
  const base = getAreaRoute(category)
  if (base === '/dashboard') return null
  if (value == null || value === '') return base
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (url.pathname !== base && !url.pathname.startsWith(base + '/')) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

export async function beginAreaAccess(user, requestedPath) {
  const category = user?.categoria?.nombre_categoria
  const area = getAreaHost(category)
  const destination = safeAreaDestination(requestedPath, category)
  if (!area) throw new Error('Acceso no disponible para esta cuenta')
  if (!destination) throw new Error('No tienes acceso a la ruta solicitada')
  if (!tenantRoot()) {
    window.location.replace(destination)
    return
  }
  const { code } = await createTransfer(area)
  const url = new URL('/auth/complete', areaOrigin(area))
  url.hash = new URLSearchParams({ code, next: destination }).toString()
  window.location.replace(url.href)
}

export function centralLoginUrl(next) {
  const url = new URL('/login', centralOrigin())
  if (next?.startsWith('/dashboard/')) url.searchParams.set('next', next)
  return url.href
}
