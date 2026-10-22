import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiError, closeSession, exchangeTransfer, login as loginRequest } from '../lib/api'
import {
  beginAreaAccess,
  centralLoginUrl,
  centralOrigin,
  currentTenant,
  safeAreaDestination,
} from '../lib/auth-navigation'
import './Login.css'

function LoginLayout({ title, description, children }) {
  return (
    <div className="login-shell">
      <div className="login-frame">
        <aside className="login-identity">
          <div className="login-brand">
            <svg className="login-brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              <path d="M12 7v6" />
              <path d="M9 10h6" />
            </svg>
            <span className="login-brand-wordmark">IATECH <span>Co.</span></span>
          </div>
          <div>
            <p className="login-eyebrow">Plataforma de inventarios</p>
            <h1>Gestión de activos por área</h1>
            <p>Un acceso para consultar el espacio de trabajo que corresponde a tu cuenta.</p>
          </div>
          <p className="login-identity-footer">Acceso institucional · IATECH Co.</p>
        </aside>
        <main id="main-content" className="login-card">
          <p className="login-section-label">Cuenta institucional</p>
          <h2>{title}</h2>
          <p className="login-description">{description}</p>
          {children}
        </main>
      </div>
    </div>
  )
}

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const location = useLocation()
  const requestedPath = new URLSearchParams(location.search).get('next') ?? location.state?.from
  const tenant = currentTenant()

  useEffect(() => {
    if (tenant) window.location.replace(centralLoginUrl(requestedPath))
  }, [tenant, requestedPath])

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      const { user } = await loginRequest(correo.trim(), contrasena)
      await beginAreaAccess(user, requestedPath)
    } catch (err) {
      setError(err instanceof ApiError && err.status >= 500
        ? 'El servicio de acceso no está disponible en este momento.'
        : err instanceof Error
          ? err.message
          : 'No se pudo conectar con el servidor')
      setIsSubmitting(false)
    }
  }

  if (tenant) return <p role="status" className="login-transition">Abriendo el acceso central…</p>

  return (
    <LoginLayout title="Iniciar sesión" description="Usa tus credenciales. Te llevaremos automáticamente a tu área autorizada.">
      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-field">
          <label htmlFor="correo">Correo institucional</label>
          <input
            id="correo"
            name="username"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            placeholder="nombre@institucion.com"
            required
            autoFocus
          />
        </div>
        <div className="login-field">
          <label htmlFor="contrasena">Contraseña</label>
          <div className="login-password">
            <input
              id="contrasena"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={contrasena}
              onChange={(event) => setContrasena(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Comprobando acceso…' : 'Entrar a mi área'}
        </button>
      </form>
    </LoginLayout>
  )
}

export function AccessRedirect() {
  const { user } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const started = useRef(false)
  const requestedPath = new URLSearchParams(location.search).get('next') ?? location.state?.from

  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    beginAreaAccess(user, requestedPath).catch((err) => setError(err.message))
  }, [user, requestedPath])

  return (
    <LoginLayout title="Preparando tu acceso" description="Estamos abriendo tu área de trabajo.">
      {error ? (
        <div role="alert" className="login-error">
          <p>{error}</p>
          <button type="button" className="login-retry" onClick={() => {
            setError('')
            beginAreaAccess(user, null).catch((err) => setError(err.message))
          }}>Ir a mi área</button>
          <button type="button" className="login-switch-account" onClick={() => {
            closeSession().catch(() => {}).finally(() => {
              window.location.replace(centralLoginUrl(requestedPath))
            })
          }}>Usar otra cuenta</button>
        </div>
      ) : <p role="status" className="login-status">Validando tu sesión…</p>}
    </LoginLayout>
  )
}

export function CompleteTransfer() {
  const location = useLocation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const started = useRef(false)
  const params = new URLSearchParams(location.hash.slice(1))
  const code = params.get('code')
  const requestedPath = params.get('next')
  const [error, setError] = useState(() =>
    !code || !currentTenant() ? 'La autorización de acceso no es válida.' : '',
  )

  useEffect(() => {
    if (started.current) return
    started.current = true
    window.history.replaceState(window.history.state, '', '/auth/complete')
    if (!code || !currentTenant()) return
    exchangeTransfer(code)
      .then(({ user }) => {
        const destination = safeAreaDestination(requestedPath, user.categoria?.nombre_categoria)
        if (!destination) throw new Error('No tienes acceso a la ruta solicitada')
        login(user)
        navigate(destination, { replace: true })
      })
      .catch((err) => setError(err.message))
  }, [code, requestedPath, login, navigate])

  return (
    <LoginLayout title="Abriendo tu área" description="Estamos terminando la comprobación de acceso.">
      {error ? (
        <div role="alert" className="login-error">
          <p>{error}</p>
          <a className="login-retry" href={centralLoginUrl()}>Volver al inicio de sesión</a>
        </div>
      ) : <p role="status" className="login-status">Comprobando autorización…</p>}
    </LoginLayout>
  )
}

export function Logout() {
  const started = useRef(false)
  const [error, setError] = useState('')
  const finishLogout = useCallback(async () => {
    setError('')
    const area = currentTenant()
    try {
      await closeSession()
    } catch (err) {
      if (!area && !(err instanceof ApiError && err.status === 401)) {
        setError('No se pudo cerrar la sesión. Reintenta para terminar el cierre de forma segura.')
        return
      }
    }
    window.location.replace(new URL(area ? '/logout' : '/login', centralOrigin()).href)
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void finishLogout()
  }, [finishLogout])

  if (error) return (
    <LoginLayout title="No se pudo cerrar sesión" description="La sesión central sigue activa.">
      <p role="alert" className="login-error">{error}</p>
      <button type="button" className="login-retry" onClick={finishLogout}>Reintentar cierre de sesión</button>
    </LoginLayout>
  )
  return <p role="status" className="login-transition">Cerrando sesión…</p>
}
