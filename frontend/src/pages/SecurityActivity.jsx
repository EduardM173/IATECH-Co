import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import AreaHeader from '../components/AreaHeader'
import { useAuth } from '../context/useAuth'
import { ApiError, listSecurityActivity } from '../lib/api'
import { getAreaRoute } from '../lib/areas'

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100'
const buttonClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
const formatDate = (date) => new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
const initialFilters = { q: '', resultado: '', periodo: '7', page: 1, pageSize: 20 }

export default function SecurityActivity() {
  const { user, token, logout } = useAuth()
  const authorized = user?.categoria?.nombre_categoria?.toUpperCase() === 'SEGURIDAD'
  const [filters, setFilters] = useState(initialFilters)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!authorized || !token) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        setResult(await listSecurityActivity(token, filters, controller.signal))
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof ApiError && err.status === 401) logout()
        else setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Intenta actualizar.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [authorized, token, filters, refresh, logout])

  if (!authorized) return <Navigate to={getAreaRoute(user?.categoria?.nombre_categoria)} replace />

  function changeFilter(key, value) {
    setLoading(true)
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }
  const meta = result?.meta
  const page = meta?.page ?? 1
  const start = meta?.total ? (page - 1) * meta.pageSize + 1 : 0
  const end = meta ? Math.min(page * meta.pageSize, meta.total) : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AreaHeader label="Seguridad" />
      <main className="mx-auto max-w-7xl p-6 md:p-8">
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Actividad de seguridad</h2>
              <p className="mt-2 text-sm text-slate-500">Supervisa los accesos al sistema de todas las áreas y detecta intentos repetidos.</p>
            </div>
            <button type="button" disabled={loading} onClick={() => { setLoading(true); setRefresh((value) => value + 1) }} className={buttonClass}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">{result && !error ? `Última actualización: ${formatDate(result.actualizado)} · Hora local` : 'Los eventos se registran desde la activación de esta función.'}</p>
        </section>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            ['Accesos exitosos', result?.resumen.exitosos, 'text-emerald-700', 'Según búsqueda y período'],
            ['Intentos fallidos', result?.resumen.fallidos, 'text-rose-700', 'Según búsqueda y período'],
            ['Correos con alerta activa', result?.resumen.alertas, 'text-amber-700', 'Todas las áreas · últimos 15 minutos'],
          ].map(([label, count, color, note]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{loading || error ? '—' : count ?? 0}</p>
              <p className="mt-2 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold">Historial de accesos</h3>
          <p className="mt-1 text-sm text-slate-500">Una alerta señala 5 o más intentos fallidos para el mismo correo en 15 minutos. No bloquea la cuenta.</p>
          <div className="my-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-600">Buscar
              <input type="search" placeholder="Correo o dirección IP" maxLength={254} value={filters.q} onChange={(event) => changeFilter('q', event.target.value)} className={`mt-2 ${inputClass}`} />
            </label>
            <label className="text-sm font-medium text-slate-600">Resultado
              <select value={filters.resultado} onChange={(event) => changeFilter('resultado', event.target.value)} className={`mt-2 ${inputClass}`}>
                <option value="">Todos los resultados</option><option value="EXITOSO">Exitosos</option><option value="FALLIDO">Fallidos</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">Período
              <select value={filters.periodo} onChange={(event) => changeFilter('periodo', event.target.value)} className={`mt-2 ${inputClass}`}>
                <option value="1">Últimas 24 horas</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="todos">Todo el historial</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">Registros por página
              <select value={filters.pageSize} onChange={(event) => changeFilter('pageSize', Number(event.target.value))} className={`mt-2 ${inputClass}`}>
                <option value={10}>10 registros</option><option value={20}>20 registros</option><option value={50}>50 registros</option>
              </select>
            </label>
          </div>
          {(filters.q || filters.resultado || filters.periodo !== '7' || filters.pageSize !== 20) && <button type="button" onClick={() => { setLoading(true); setFilters(initialFilters) }} className="mb-4 text-sm font-medium text-rose-700 hover:underline">Limpiar filtros</button>}
          {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr>
                {['Fecha y hora', 'Correo', 'Dirección IP', 'Resultado', 'Alerta'].map((title) => <th key={title} scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-3">{title}</th>)}
              </tr></thead>
              <tbody>
                {!loading && !error && result?.data.map((item) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(item.fecha)}</td>
                  <td className="px-4 py-4 break-all">{item.correo}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">{item.ip}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${item.resultado === 'EXITOSO' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{item.resultado === 'EXITOSO' ? 'Exitoso' : 'Fallido'}</span></td>
                  <td className="px-4 py-4">{item.alerta ? <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Fallos repetidos</span> : <span className="text-slate-400">—</span>}</td>
                </tr>)}
              </tbody>
            </table>
            {loading && <p role="status" className="p-8 text-center text-sm text-slate-500">Cargando actividad…</p>}
            {!loading && !error && !result?.data.length && <div className="p-8 text-center"><p className="text-sm font-medium text-slate-700">No se encontraron accesos</p><p className="mt-2 text-sm text-slate-500">Prueba otros filtros o realiza un inicio de sesión para registrar actividad.</p></div>}
          </div>
          {!loading && !error && meta?.total > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
            <p>{start}–{end} de {meta.total} registros</p>
            {meta.totalPages > 1 && <div className="flex items-center gap-3">
              <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: page - 1 })) }} className={buttonClass}>Anterior</button>
              <span aria-live="polite">Página {page} de {meta.totalPages}</span>
              <button type="button" disabled={page >= meta.totalPages} onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: page + 1 })) }} className={buttonClass}>Siguiente</button>
            </div>}
          </div>}
        </section>
      </main>
    </div>
  )
}
