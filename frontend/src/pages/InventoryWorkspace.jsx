import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getAreaRoute } from "../lib/areas";
import {
  ApiError,
  inventoryMetadata,
  inventoryList,
  inventoryReport,
  inventoryExport,
} from "../lib/api";
import AreaHeader from "../components/AreaHeader";
import InventoryFilters from "../components/InventoryFilters";
import InventoryEditor from "../components/InventoryEditor";
const input =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500";
const emptyCriteria = {
  q: "",
  filters: [],
  page: 1,
  pageSize: 20,
  direction: "desc",
};
const display = (value) =>
  value === null || value === undefined ? "Sin dato" : String(value);
const activeFilters = (filters) =>
  filters.filter(
    (f) =>
      ["isNull", "notNull"].includes(f.op) ||
      (f.value !== "" && f.value !== undefined && (f.op !== "between" || f.to)),
  );
function CrossTable({ result }) {
  const [first, second] = result.groupBy;
  const key = (v) => JSON.stringify(v);
  const rows = [
    ...new Map(
      result.data.map((row) => [key(row[first]), row[first]]),
    ).values(),
  ];
  const columns = [
    ...new Map(
      result.data.map((row) => [key(row[second]), row[second]]),
    ).values(),
  ];
  const cells = new Map(
    result.data.map((row) => [key([row[first], row[second]]), row.valor]),
  );
  return (
    <div className="mt-6">
      <h3 className="mb-3 font-semibold">
        Tabla cruzada: {first} × {second}
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        Se muestran los grupos de esta página. — indica una combinación sin
        resultado en esta página.
      </p>
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3">
                {first} / {second}
              </th>
              {columns.map((v) => (
                <th key={key(v)} className="p-3">
                  {display(v)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={key(row)} className="border-b border-slate-100">
                <th className="p-3">{display(row)}</th>
                {columns.map((column) => (
                  <td key={key(column)} className="p-3">
                    {display(cells.get(key([row, column])) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function InventoryWorkspace({ mode }) {
  const { area } = useParams(),
    { user, token, logout } = useAuth();
  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria);
  const authorized = ownRoute === "/dashboard/" + area;
  const [config, setConfig] = useState(null),
    [result, setResult] = useState(null);
  const [criteria, setCriteria] = useState(emptyCriteria),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [group1, setGroup1] = useState(""),
    [group2, setGroup2] = useState(""),
    [metric, setMetric] = useState("count");
  const [columns, setColumns] = useState([]),
    [editor, setEditor] = useState(undefined),
    [refresh, setRefresh] = useState(0),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    inventoryMetadata(area, token, controller.signal)
      .then(setConfig)
      .catch((err) => {
        if (!controller.signal.aborted) {
          if (err.status === 401) logout();
          else setError(err.message);
        }
      });
    return () => controller.abort();
  }, [area, authorized, token, logout]);
  useEffect(() => {
    if (!authorized || !config?.enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        const query = { ...criteria, filters: activeFilters(criteria.filters) };
        try {
          const data =
            mode === "reports"
              ? await inventoryReport(
                  area,
                  token,
                  {
                    ...query,
                    groupBy: [group1, group2].filter(Boolean),
                    metric,
                    metricColumn: "costo_total_usd",
                    columns: columns.length
                      ? columns
                      : config.fields.map((f) => f.name),
                  },
                  controller.signal,
                )
              : await inventoryList(area, token, query, controller.signal);
          setResult(data);
        } catch (err) {
          if (controller.signal.aborted) return;
          if (err instanceof ApiError && err.status === 401) logout();
          else setError(err.message ?? "No se pudo conectar con el servidor");
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      criteria.q ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    area,
    authorized,
    token,
    config,
    criteria,
    mode,
    group1,
    group2,
    metric,
    columns,
    refresh,
    logout,
  ]);
  if (!authorized) return <Navigate to={ownRoute} replace />;
  const label = config?.label ?? user?.categoria?.nombre_categoria ?? area;
  const title =
    mode === "reports"
      ? "Reportes"
      : mode === "bi"
        ? "BI y exportación"
        : label;
  function change(value) {
    setLoading(true);
    setCriteria(value);
  }
  function chooseGroup(which, value) {
    setCriteria((c) => ({ ...c, page: 1 }));
    (which === 1 ? setGroup1 : setGroup2)(value);
    if (which === 1 && !value) setGroup2("");
  }
  async function download() {
    setExporting(true);
    setError("");
    try {
      const blob = await inventoryExport(area, token, {
        q: criteria.q,
        filters: activeFilters(criteria.filters),
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "inventario-" + area + ".xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }
  const shownColumns =
    result?.columns ?? config?.fields?.map((f) => f.name) ?? [];
  const groupFields =
    config?.fields?.filter(
      (f) => f.name !== config.id && !f.name.startsWith("nombre"),
    ) ?? [];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AreaHeader label={label} />
      <main className="mx-auto max-w-[1600px] p-6 md:p-8">
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {mode === "reports"
                  ? "Consulta columnas individuales o cruza dos columnas de tu inventario."
                  : mode === "bi"
                    ? "Exporta los registros originales para Tableau o Power BI."
                    : "Registros del área con los atributos aprobados."}
              </p>
            </div>
            {mode === "inventory" &&
              config?.enabled &&
              user.rol === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="h-fit rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Nuevo registro
                </button>
              )}
          </div>
        </section>
        {!config && !error && (
          <p role="status" className="p-8 text-center text-slate-500">
            Cargando configuración del área…
          </p>
        )}
        {config && !config.enabled && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h3 className="font-semibold">
              Área preparada, inventario pendiente
            </h3>
            <p className="mt-2 text-sm">
              {config.reason}. Reportes y BI estarán disponibles cuando se
              entregue el diccionario.
            </p>
          </section>
        )}
        {editor !== undefined && config?.enabled && (
          <InventoryEditor
            key={editor?.[config.id] ?? "new"}
            config={config}
            area={area}
            token={token}
            record={editor}
            onClose={() => setEditor(undefined)}
            onSaved={() => {
              setEditor(undefined);
              setRefresh((v) => v + 1);
            }}
          />
        )}
        {config?.enabled && (
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <InventoryFilters
              fields={config.fields}
              criteria={criteria}
              onChange={change}
            />
            {mode === "reports" && (
              <div className="mb-6 space-y-4 rounded-xl bg-slate-50 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium">
                    Agrupar por
                    <select
                      className={input + " mt-2 w-full"}
                      value={group1}
                      onChange={(e) => chooseGroup(1, e.target.value)}
                    >
                      <option value="">Detalle de registros</option>
                      {groupFields
                        .filter((f) => f.name !== group2)
                        .map((f) => (
                          <option key={f.name}>{f.name}</option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Cruzar con
                    <select
                      disabled={!group1}
                      className={input + " mt-2 w-full"}
                      value={group2}
                      onChange={(e) => chooseGroup(2, e.target.value)}
                    >
                      <option value="">Sin cruce</option>
                      {groupFields
                        .filter((f) => f.name !== group1)
                        .map((f) => (
                          <option key={f.name}>{f.name}</option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Métrica
                    <select
                      className={input + " mt-2 w-full"}
                      value={metric}
                      onChange={(e) => {
                        setMetric(e.target.value);
                        setCriteria((c) => ({ ...c, page: 1 }));
                      }}
                    >
                      <option value="count">Cantidad de registros</option>
                      {config.area === "software" &&
                        ["sum", "avg", "min", "max"].map((m) => (
                          <option key={m} value={m}>
                            {
                              {
                                sum: "Suma",
                                avg: "Promedio",
                                min: "Mínimo",
                                max: "Máximo",
                              }[m]
                            }{" "}
                            de costo_total_usd
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {!group1 && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">
                      Columnas del reporte detallado (todas si no seleccionas)
                    </legend>
                    <div className="flex flex-wrap gap-3">
                      {config.fields.map((field) => (
                        <label
                          key={field.name}
                          className="flex items-center gap-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={columns.includes(field.name)}
                            onChange={(e) =>
                              setColumns(
                                e.target.checked
                                  ? [...columns, field.name]
                                  : columns.filter((c) => c !== field.name),
                              )
                            }
                          />
                          {field.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            )}
            {mode === "bi" && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-rose-50 p-4">
                <div>
                  <p className="text-sm font-semibold">
                    Archivo XLSX del inventario
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Máximo {config.maxExport.toLocaleString()} registros.
                    Incluye todas las columnas originales y los filtros
                    actuales.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={exporting || loading}
                  onClick={download}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {exporting ? "Generando Excel…" : "Descargar Excel"}
                </button>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {loading
                  ? "Cargando…"
                  : (result?.meta.total ?? 0) +
                    " " +
                    (mode === "reports" && group1 ? "grupos" : "registros")}
              </p>
              <div className="flex flex-wrap gap-2">
                {mode !== "reports" && (
                  <>
                    <select
                      aria-label="Ordenar por columna"
                      className={input}
                      value={criteria.sort ?? config.id}
                      onChange={(e) =>
                        change({ ...criteria, sort: e.target.value, page: 1 })
                      }
                    >
                      {config.fields.map((f) => (
                        <option key={f.name}>{f.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Dirección del orden"
                      className={input}
                      value={criteria.direction}
                      onChange={(e) =>
                        change({
                          ...criteria,
                          direction: e.target.value,
                          page: 1,
                        })
                      }
                    >
                      <option value="asc">Ascendente</option>
                      <option value="desc">Descendente</option>
                    </select>
                  </>
                )}
                <select
                  aria-label="Registros por página"
                  className={input}
                  value={criteria.pageSize}
                  onChange={(e) =>
                    change({
                      ...criteria,
                      pageSize: Number(e.target.value),
                      page: 1,
                    })
                  }
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} por página
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            {result?.note && (
              <p className="mb-4 text-xs text-amber-700">{result.note}</p>
            )}
            <div className="max-w-full overflow-auto" aria-busy={loading}>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {shownColumns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border-b border-slate-200 px-4 py-3"
                      >
                        {column}
                      </th>
                    ))}
                    {mode === "inventory" && user.rol === "ADMIN" && (
                      <th className="px-4 py-3">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {!loading &&
                    !error &&
                    result?.data.map((row, index) => (
                      <tr
                        key={row[config.id] ?? JSON.stringify(row) + index}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        {shownColumns.map((column) => (
                          <td
                            key={column}
                            className={
                              "max-w-xs px-4 py-3 " +
                              (row[column] === null
                                ? "italic text-slate-400"
                                : "")
                            }
                          >
                            <span className="block break-words">
                              {display(row[column])}
                            </span>
                          </td>
                        ))}
                        {mode === "inventory" && user.rol === "ADMIN" && (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setEditor(row)}
                              className="text-rose-700"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {loading && (
              <p
                role="status"
                className="p-8 text-center text-sm text-slate-500"
              >
                Cargando datos…
              </p>
            )}
            {!loading && !error && !result?.data.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                {criteria.q || activeFilters(criteria.filters).length
                  ? "No se encontraron registros con estos filtros."
                  : "Todavía no hay registros en este inventario."}
              </p>
            )}
            {!loading &&
              !error &&
              result?.mode === "cross" &&
              result.data.length > 0 && <CrossTable result={result} />}
            {!loading &&
              !error &&
              result?.mode === "group" &&
              metric === "count" &&
              result.data.length > 0 && (
                <div
                  aria-label="Gráfico de cantidad por grupo"
                  className="mt-6 space-y-3"
                >
                  <h3 className="font-semibold">Cantidad por {group1}</h3>
                  {result.data.slice(0, 20).map((row) => (
                    <div key={JSON.stringify(row)}>
                      <div className="mb-1 flex justify-between text-xs text-slate-600">
                        <span>{display(row[group1])}</span>
                        <span>{row.valor}</span>
                      </div>
                      <div className="h-3 rounded bg-slate-100">
                        <div
                          className="h-3 rounded bg-rose-500"
                          style={{
                            width:
                              (Number(row.valor) /
                                Math.max(
                                  ...result.data.map((r) => Number(r.valor)),
                                )) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">
                    Hasta veinte grupos de la página actual.
                  </p>
                </div>
              )}
            {!loading && !error && result?.meta.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-end gap-3 text-sm">
                <button
                  className={input}
                  disabled={criteria.page === 1}
                  onClick={() =>
                    change({ ...criteria, page: criteria.page - 1 })
                  }
                >
                  Anterior
                </button>
                <span>
                  Página {criteria.page} de {result.meta.totalPages}
                </span>
                <button
                  className={input}
                  disabled={criteria.page >= result.meta.totalPages}
                  onClick={() =>
                    change({ ...criteria, page: criteria.page + 1 })
                  }
                >
                  Siguiente
                </button>
              </div>
            )}
          </section>
        )}
        {!config && error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
