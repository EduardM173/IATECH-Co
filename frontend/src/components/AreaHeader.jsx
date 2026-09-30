import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getAreaRoute } from '../lib/areas'

export default function AreaHeader({ label }) {
  const { user, logout } = useAuth()
  const security = user?.categoria?.nombre_categoria?.toUpperCase() === 'SEGURIDAD'
  const linkClass = ({ isActive }) => `rounded-lg px-4 py-2 text-sm font-medium ${isActive ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-8">
        <div>
          <h1 className="text-xl font-bold">IATECH Co. · {label}</h1>
          <p className="text-sm text-slate-500">Control de activos por área</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>{user?.nombre}</span>
          <button type="button" onClick={logout} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100">Cerrar sesión</button>
        </div>
      </div>
      {security && (
        <nav aria-label="Secciones de Seguridad" className="flex flex-wrap gap-2 border-t border-slate-100 px-6 py-3 md:px-8">
          <NavLink end to={getAreaRoute(user.categoria.nombre_categoria)} className={linkClass}>Inventario</NavLink>
          <NavLink to="/dashboard/seguridad/actividad" className={linkClass}>Actividad de seguridad</NavLink>
        </nav>
      )}
    </header>
  )
}
