import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login as loginRequest, ApiError } from '../lib/api'
import { getAreaRoute } from '../lib/areas'
import './Login.css'

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
    <section id="login">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>IATECH Inventario</h1>
        <p className="login-subtitle">Inicia sesión con tu cuenta de área</p>

        <label htmlFor="correo">Correo</label>
        <input
          id="correo"
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          required
        />

        <label htmlFor="contrasena">Contraseña</label>
        <input
          id="contrasena"
          type="password"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="login-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </section>
  )
}

export default Login
