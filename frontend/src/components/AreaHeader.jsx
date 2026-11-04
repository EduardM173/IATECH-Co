import { useState } from "react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getAreaRoute } from "../lib/areas";
import { inventoryExport } from "../lib/api";
import "./AreaHeader.css";

export const activityEnabled =
  import.meta.env.VITE_FEATURE_SECURITY_ACTIVITY === "true";

export default function AreaHeader({ label }) {
  const { user, token, logout } = useAuth();
  const { area } = useParams();
  const { pathname } = useLocation();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const base = getAreaRoute(user?.categoria?.nombre_categoria);
  const security = user?.categoria?.nombre_categoria === "SEGURIDAD";
  const onBiPage = pathname.replace(/\/$/, "") === `${base}/bi`;
  const linkClass = ({ isActive }) =>
    "area-header-link" + (isActive ? " is-active" : "");

  async function downloadInventory() {
    if (exporting || !area) return;
    setExporting(true);
    setExportError("");
    try {
      const blob = await inventoryExport(area, token, {});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "inventario-" + area + ".xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <a className="area-header-skip" href="#main-content">
        Saltar al contenido principal
      </a>
      <header className="area-header">
        <div className="area-header-top">
          <div className="area-header-identity">
            <div className="area-header-brand">
              IATECH <span>Co.</span>
            </div>
            <span className="area-header-divider" aria-hidden="true" />
            <div className="area-header-area">
              <span>Área de trabajo</span>
              <strong>{label}</strong>
            </div>
            <p className="area-header-subtitle">Control de activos por área</p>
          </div>

          <div className="area-header-session">
            <div className="area-header-user">
              <span>{user?.rol ?? "Usuario"}</span>
              <strong title={user?.nombre}>{user?.nombre}</strong>
            </div>
            <button
              type="button"
              onClick={logout}
              className="area-header-logout"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="area-header-nav-wrap">
          <nav aria-label="Navegación principal" className="area-header-nav">
            <NavLink end to={base} className={linkClass}>
              Inventario
            </NavLink>
            <NavLink to={base + "/reportes"} className={linkClass}>
              Reportes
            </NavLink>
            <button
              type="button"
              onClick={downloadInventory}
              disabled={exporting}
              className={
                "area-header-link area-header-bi" +
                (onBiPage ? " is-active" : "")
              }
              aria-current={onBiPage ? "page" : undefined}
              aria-label={
                exporting
                  ? "Descargando inventario Excel"
                  : "Descargar inventario Excel para BI"
              }
            >
              {exporting ? "Preparando Excel…" : "BI"}
            </button>
            {security && activityEnabled && (
              <NavLink to={base + "/actividad"} className={linkClass}>
                Actividad de seguridad
              </NavLink>
            )}
          </nav>
        </div>
        {exportError && (
          <p role="alert" className="area-header-error">
            No se pudo descargar el Excel: {exportError}
          </p>
        )}
      </header>
    </>
  );
}
