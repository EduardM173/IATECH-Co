const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function login(correo, contrasena) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(data?.message ?? 'No se pudo iniciar sesión', response.status)
  }

  return data
}

export async function listActivos(area, token, search = '', page = 1, signal) {
  const apiArea = area === 'big-data' ? 'bigdata' : area
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  if (search.trim()) params.set('q', search.trim())

  const response = await fetch(`${API_URL}/activos/${apiArea}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(data?.message ?? 'No se pudieron cargar los activos', response.status)
  }
  return data
}

export async function listSecurityActivity(token, filters, signal) {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize), periodo: filters.periodo })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.resultado) params.set('resultado', filters.resultado)
  const response = await fetch(`${API_URL}/seguridad/actividad?${params}`, {
    headers: { Authorization: `Bearer ${token}` }, signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.message ?? 'No se pudo cargar la actividad de seguridad', response.status)
  return data
}
