import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAreaRoute } from '../lib/areas'
import './AreaDashboard.css'

const AREA_LABELS = {
  hardware: 'Hardware',
  software: 'Software',
  redes: 'Redes',
  seguridad: 'Seguridad',
  calidad: 'Calidad',
  cloud: 'Cloud',
  'big-data': 'Big Data Analíticas',
}

function AreaDashboard() {
  const { area } = useParams()
  const { user, logout } = useAuth()

  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria)
  if (ownRoute !== `/dashboard/${area}`) {
    return <Navigate to={ownRoute} replace />
  }

  return (
    <section id="area-dashboard">
      <header>
        <div>
          <h1>{AREA_LABELS[area] ?? area}</h1>
          <p>Bienvenido/a, {user?.nombre}</p>
        </div>
        <button type="button" className="logout" onClick={logout}>
          Cerrar sesión
        </button>
      </header>

      <p className="placeholder">
        Aquí irá el inventario de activos del área de {AREA_LABELS[area] ?? area}.
      </p>
    </section>
  )
}

export default AreaDashboard
