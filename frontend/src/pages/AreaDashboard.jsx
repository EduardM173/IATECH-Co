import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import AreaHeader from "../components/AreaHeader";
import { useAuth } from "../context/useAuth";
import { ApiError, listActivos } from "../lib/api";
import {
  formatInventoryValue,
  getAreaRoute,
  getAreaViewByRoute,
} from "../lib/areas";

function AreaDashboard() {
  const { area } = useParams();
  const { user, token, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria);
  const areaView = getAreaViewByRoute(area);

  useEffect(() => {
    if (ownRoute !== `/dashboard/${area}` || !token) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        try {
          const result = await listActivos(
            area,
            token,
            searchTerm,
            page,
            controller.signal,
          );
          setItems(result.data);
          setTotal(result.meta.total);
          setTotalPages(result.meta.totalPages);
        } catch (err) {
          if (controller.signal.aborted) return;
          if (err instanceof ApiError && err.status === 401) logout();
          else
            setError(
              err instanceof ApiError
                ? err.message
                : "No se pudo conectar con el servidor",
            );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      searchTerm ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [area, token, searchTerm, page, ownRoute, logout]);

  if (ownRoute !== `/dashboard/${area}`)
    return <Navigate to={ownRoute} replace />;

  const label = areaView?.label ?? area;
  const fieldLabels = areaView?.fields ?? {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AreaHeader label={label} />

      <main className="mx-auto max-w-7xl p-6 md:p-8">
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Inventario de {label}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Cargando…" : `${total} registros del área`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h3 className="font-semibold">Registros</h3>
            <input
              type="search"
              aria-label="Buscar en el inventario"
              placeholder="Buscar por nombre, responsable o detalle"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-600"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3">ID</th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Nombre
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Datos del área
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Responsable
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Modificación
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id_inventario}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="px-4 py-3 font-mono">
                      {item.id_inventario}
                    </td>
                    <td className="px-4 py-3 font-medium">{item.nombre}</td>
                    <td className="min-w-72 px-4 py-3 text-slate-600">
                      <dl className="grid gap-1">
                        {Object.entries(item.detalle ?? {}).map(
                          ([field, value]) => (
                            <div key={field} className="flex gap-2">
                              <dt className="font-medium text-slate-700">
                                {fieldLabels[field] ?? field}:
                              </dt>
                              <dd className="break-all">
                                {formatInventoryValue(field, value)}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </td>
                    <td className="px-4 py-3">{item.responsable || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Intl.DateTimeFormat("es-BO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.fecha_modificacion))}
                    </td>
                    <td className="px-4 py-3">{item.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !error && items.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  El inventario del área está vacío
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Los registros nuevos aparecerán aquí.
                </p>
              </div>
            )}
            {loading && (
              <p
                role="status"
                className="p-8 text-center text-sm text-slate-500"
              >
                Cargando inventario…
              </p>
            )}
          </div>

          {!loading && totalPages > 1 && (
            <div className="mt-5 flex items-center justify-end gap-3 text-sm">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AreaDashboard;
