import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AreaDashboard from './pages/AreaDashboard'
import Login from './pages/Login'
import { getAreaRoute } from './lib/areas'

function App() {
  const { isAuthenticated, user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={getAreaRoute(user?.categoria?.nombre_categoria)} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard/:area" element={<AreaDashboard />} />
      </Route>

      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? getAreaRoute(user?.categoria?.nombre_categoria) : '/login'} replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
