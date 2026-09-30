import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login as loginRequest, ApiError } from '../lib/api'
import { getAreaRoute } from '../lib/areas'

function Login() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { user, token } = await loginRequest(correo, contrasena)
      login(user, token)

      const redirectTo = location.state?.from ?? getAreaRoute(user.categoria?.nombre_categoria)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="flex-1 flex items-center justify-center p-10 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-10 shadow-xl text-left">
        <div className="mb-7 text-center">
          <div className="inline-flex items-center gap-2 mb-3.5 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full text-rose-600 text-xs font-bold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              <path d="M12 7v6"/>
              <path d="M9 10h6"/>
            </svg>
            <span>Sistema Hospitalario - IATECH Co.</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1.5">Gestión de Activos por Área</h1>
          <p className="text-xs text-slate-500 leading-relaxed">Ingrese sus credenciales para acceder al inventario hospitalario</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="correo" className="block text-xs font-bold text-slate-900 mb-2">Correo Institucional</label>
            <div className="relative flex items-center">
              <svg className="absolute left-3.5 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <input
                id="correo"
                type="email"
                placeholder="ejemplo@iatech.com"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                className="w-full py-2.5 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none transition-all focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          <div className="mb-5">
            <label htmlFor="contrasena" className="block text-xs font-bold text-slate-900 mb-2">Contraseña</label>
            <div className="relative flex items-center">
              <svg className="absolute left-3.5 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="contrasena"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
                className="w-full py-2.5 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none transition-all focus:bg-white focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold p-3 rounded-lg mb-5">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-5 rounded-lg border-0 bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 text-white text-sm font-bold cursor-pointer shadow-md hover:from-rose-700 hover:to-rose-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default Login
