import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { currentTenant, tenantRoot } from '../lib/auth-navigation'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated || (tenantRoot() && !currentTenant())) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />
  }

  return <Outlet />
}
