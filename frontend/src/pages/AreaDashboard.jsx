import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiError, listActivos } from '../lib/api'
import { getAreaRoute } from '../lib/areas'

const AREA_LABELS = {
  hardware: 'Hardware', software: 'Software', redes: 'Redes', seguridad: 'Seguridad',
  calidad: 'Calidad', cloud: 'Cloud', 'big-data': 'Big Data',
}

function AreaDashboard() {
  const { area } = useParams()
  const { user, token, logout } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria)

  useEffect(() => {
    if (ownRoute !== `/dashboard/${area}` || !token) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const result = await listActivos(area, token, searchTerm, page, controller.signal)
        setItems(result.data)
        setTotal(result.meta.total)
        setTotalPages(result.meta.totalPages)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof ApiError && err.status === 401) {
          logout()
        } else {
          setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [area, token, searchTerm, page, ownRoute, logout])

  if (ownRoute !== `/dashboard/${area}`) return <Navigate to={ownRoute} replace />

  const label = AREA_LABELS[area] ?? area
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="text-xl font-bold">IATECH Co. · {label}</h1>
          <p className="text-sm text-slate-500">Control de activos por área</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>{user?.nombre}</span>
          <button type="button" onClick={logout} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100">Cerrar sesión</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 md:p-8">
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Inventario de {label}</h2>
          <p className="mt-1 text-sm text-slate-500">{loading ? 'Cargando…' : `${total} activos registrados`}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-semibold">Activos del área</h3>
            <input
              type="search"
              aria-label="Buscar activos"
              placeholder="Buscar por código, descripción o detalle"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }}
              className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-600"
            />
          </div>

          {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">Código</th>
                  <th className="border-b border-slate-200 px-4 py-3">Descripción</th>
                  <th className="border-b border-slate-200 px-4 py-3">Detalle</th>
                  <th className="border-b border-slate-200 px-4 py-3">Registro</th>
                  <th className="border-b border-slate-200 px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id_activo} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono">{item.codigo}</td>
                    <td className="px-4 py-3">{item.descripcion}</td>
                    <td className="px-4 py-3 text-slate-500">{Object.values(item.detalle ?? {}).filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3">{item.fecha_registro?.slice(0, 10)}</td>
                    <td className="px-4 py-3">{item.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !error && items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No se encontraron activos.</p>}
            {loading && <p className="p-8 text-center text-sm text-slate-500">Cargando activos…</p>}
          </div>
          {!loading && totalPages > 1 && (
            <div className="mt-5 flex items-center justify-end gap-3 text-sm">
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50">Anterior</button>
              <span>Página {page} de {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50">Siguiente</button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AreaDashboard
