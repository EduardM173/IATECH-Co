import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./context/useAuth";
import Login, { AccessRedirect, CompleteTransfer, Logout } from "./pages/Login";
import SecurityActivity from "./pages/SecurityActivity";
import { getAreaRoute } from "./lib/areas";
import { activityEnabled } from "./components/AreaHeader";
import InventoryWorkspace from "./pages/InventoryWorkspace";
import ReportsWorkspace from "./pages/ReportsWorkspace";
import { currentTenant } from "./lib/auth-navigation";

function App() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading)
    return (
      <p role="status" className="p-10 text-center text-slate-500">
        Comprobando sesión…
      </p>
    );

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated
            ? currentTenant()
              ? <Navigate to={getAreaRoute(user?.categoria?.nombre_categoria)} replace />
              : <AccessRedirect />
            : <Login />
        }
      />

      <Route path="/auth/complete" element={<CompleteTransfer />} />
      <Route path="/logout" element={<Logout />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard/:area"
          element={<InventoryWorkspace mode="inventory" />}
        />
        <Route
          path="/dashboard/:area/reportes"
          element={<ReportsWorkspace />}
        />
        <Route
          path="/dashboard/:area/bi"
          element={<InventoryWorkspace mode="bi" />}
        />
        <Route
          path="/dashboard/seguridad/actividad"
          element={
            activityEnabled ? (
              <SecurityActivity />
            ) : (
              <Navigate to="/dashboard/seguridad" replace />
            )
          }
        />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to={
              isAuthenticated && currentTenant()
                ? getAreaRoute(user?.categoria?.nombre_categoria)
                : "/login"
            }
            replace
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
