import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import AreaHeader from "../components/AreaHeader";
import InventoryFilters from "../components/InventoryFilters";
import { useAuth } from "../context/useAuth";
import { inventoryMetadata, inventoryReport } from "../lib/api";
import { getAreaRoute } from "../lib/areas";
import "./ReportsWorkspace.css";

const baseCriteria = {
  q: "",
  filters: [],
  page: 1,
  pageSize: 20,
  direction: "desc",
};
const number = new Intl.NumberFormat("es-BO");
const percent = new Intl.NumberFormat("es-BO", {
  style: "percent",
  maximumFractionDigits: 1,
});
const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600";
const fieldLabel = (name) => name.replaceAll("_", " ");
const label = (value) => (value === null ? "Sin dato (NULL)" : String(value));
const key = (value) => JSON.stringify(value);
const activeFilters = (filters) =>
  filters.filter(
    (filter) =>
      ["isNull", "notNull"].includes(filter.op) ||
      (filter.value !== "" &&
        filter.value !== undefined &&
        (filter.op !== "between" || filter.to)),
  );
const groupable = (field, id) =>
  field.name !== id &&
  !field.name.startsWith("nombre") &&
  ["varchar", "date", "timestamp"].includes(field.type);
const fieldType = (field) =>
  field?.type === "date" || field?.type === "timestamp";
const metricText = {
  count: "Registros",
  sum: "Suma",
  avg: "Promedio",
  min: "Mínimo",
  max: "Máximo",
};
const formatMetric = (value, metric) =>
  value === null
    ? "Sin valor (NULL)"
    : metric === "count"
      ? number.format(Number(value))
      : `${value} USD`;

function DetailTable({ result, loading, error, page, onPage, title }) {
  return (
    <section className="report-detail" aria-label={title}>
      <div className="report-section-heading">
        <div>
          <h3>{title}</h3>
          <p>
            {result
              ? `${number.format(result.meta.total)} registros originales`
              : "Consulta los datos que originan el resultado."}
          </p>
        </div>
        {result?.meta.totalPages > 1 && (
          <div className="report-pagination">
            <button
              type="button"
              className={focusClass}
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {result.meta.totalPages}
            </span>
            <button
              type="button"
              className={focusClass}
              disabled={page >= result.meta.totalPages}
              onClick={() => onPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="report-error">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="report-empty">
          Cargando registros…
        </p>
      )}
      {!loading && result && !result.data.length && (
        <p className="report-empty">No hay registros para este resultado.</p>
      )}
      {!loading && result?.data.length > 0 && (
        <div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th scope="col" key={column}>
                    {fieldLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((row, index) => (
                <tr key={key(row) + index}>
                  {result.columns.map((column) => (
                    <td
                      key={column}
                      className={row[column] === null ? "report-null" : ""}
                    >
                      {label(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ReportsWorkspace() {
  const { area } = useParams();
  const { user, token, logout } = useAuth();
  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria);
  const authorized = ownRoute === "/dashboard/" + area;
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [mode, setMode] = useState("individual");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [metric, setMetric] = useState("count");
  const [period, setPeriod] = useState("month");
  const [criteria, setCriteria] = useState(baseCriteria);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [individualView, setIndividualView] = useState("visual");
  const [crossView, setCrossView] = useState("matrix");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [matrixSort, setMatrixSort] = useState("domain");
  const [matrixPage, setMatrixPage] = useState(1);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupPage, setGroupPage] = useState(1);
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const summaryVersion = useRef(0);
  const detailVersion = useRef(0);
  const options =
    config?.fields?.filter((field) => groupable(field, config.id)) ?? [];
  const selectedField = config?.fields?.find((field) => field.name === primary);
  const otherField = config?.fields?.find((field) => field.name === secondary);
  const isDetailView =
    mode === "individual" &&
    selectedField &&
    !groupable(selectedField, config.id);
  const isDateView =
    fieldType(selectedField) || (mode === "cross" && fieldType(otherField));
  const active = activeFilters(criteria.filters);
  const measureField = config?.fields?.find(
    (field) => field.type === "decimal",
  );
  const pageForAnalysis = isDetailView ? detailPage : 1;

  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    inventoryMetadata(area, token, controller.signal)
      .then((metadata) => {
        if (controller.signal.aborted) return;
        setConfig(metadata);
        if (metadata.enabled) {
          const candidates = metadata.fields.filter((field) =>
            groupable(field, metadata.id),
          );
          const first =
            candidates.find((field) => field.values)?.name ??
            candidates[0]?.name ??
            metadata.id;
          setPrimary(first);
          setSecondary(
            candidates.find((field) => field.name !== first)?.name ?? "",
          );
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) logout();
        else setConfigError(error.message);
      });
    return () => controller.abort();
  }, [area, authorized, token, logout]);

  useEffect(() => {
    if (
      !authorized ||
      !config?.enabled ||
      !primary ||
      (mode === "cross" && !secondary)
    )
      return;
    const controller = new AbortController();
    const version = ++summaryVersion.current;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setSummaryError("");
        try {
          const groupBy =
            mode === "cross"
              ? [primary, secondary]
              : isDetailView
                ? []
                : [primary];
          const result = await inventoryReport(
            area,
            token,
            {
              q: criteria.q,
              filters: activeFilters(criteria.filters),
              groupBy,
              period,
              metric: groupBy.length ? metric : "count",
              ...(metric !== "count" && groupBy.length
                ? { metricColumn: measureField?.name }
                : {}),
              ...(groupBy.length
                ? {}
                : { page: pageForAnalysis, pageSize: 20 }),
            },
            controller.signal,
          );
          if (result.mode !== "detail" && !result.grandTotal)
            throw new Error("El backend usa una versión anterior de Reportes. Reinícialo para activar esta pantalla.");
          if (!controller.signal.aborted && version === summaryVersion.current)
            setSummary(result);
        } catch (error) {
          if (
            !controller.signal.aborted &&
            version === summaryVersion.current
          ) {
            if (error.status === 401) logout();
            else
              setSummaryError(error.message ?? "No se pudo cargar el reporte");
            setSummary(null);
          }
        } finally {
          if (!controller.signal.aborted && version === summaryVersion.current)
            setLoading(false);
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
    config,
    primary,
    secondary,
    mode,
    metric,
    measureField?.name,
    period,
    criteria,
    pageForAnalysis,
    isDetailView,
    token,
    logout,
  ]);

  useEffect(() => {
    if (!selection || !config?.enabled || !authorized) return;
    const controller = new AbortController();
    const version = ++detailVersion.current;
    inventoryReport(
      area,
      token,
      {
        q: criteria.q,
        filters: activeFilters(criteria.filters),
        groupBy: [],
        drilldown: selection,
        period,
        page: detailPage,
        pageSize: 20,
      },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted && version === detailVersion.current)
          setDetail(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted && version === detailVersion.current) {
          if (error.status === 401) logout();
          else
            setDetailError(error.message ?? "No se pudo consultar el detalle");
          setDetail(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && version === detailVersion.current)
          setDetailLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [
    selection,
    detailPage,
    area,
    token,
    config,
    criteria,
    period,
    authorized,
    logout,
  ]);

  if (!authorized) return <Navigate to={ownRoute} replace />;
  const note =
    metric === "count"
      ? "Porcentaje del total general de registros filtrados."
      : "La cantidad y el porcentaje se basan en registros; la métrica numérica se calcula por separado.";
  const totalCount = summary?.grandTotal?.cantidad ?? summary?.meta?.total ?? 0;
  const grouped = summary?.mode === "group";
  const crossed = summary?.mode === "cross";
  const counts = summary?.data ?? [];
  const allRows = summary?.rowTotals ?? [];
  const allColumns = summary?.columnTotals ?? [];
  const visibleColumns = allColumns.filter((row) =>
    label(row[secondary])
      .toLocaleLowerCase("es")
      .includes(columnSearch.toLocaleLowerCase("es")),
  );
  const matchingRows = allRows.filter((row) =>
    label(row[primary])
      .toLocaleLowerCase("es")
      .includes(matrixSearch.toLocaleLowerCase("es")),
  );
  const sortedRows =
    matrixSort === "count"
      ? [...matchingRows].sort((a, b) => b.cantidad - a.cantidad)
      : matchingRows;
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / 20));
  const visibleRows = sortedRows.slice((matrixPage - 1) * 20, matrixPage * 20);
  const cellMap = new Map(
    counts.map((row) => [key([row[primary], row[secondary]]), row]),
  );
  const crossChartPossible =
    crossed &&
    metric === "count" &&
    allColumns.length <= 6 &&
    allRows.length <= 12;
  const visualAllowed = counts.every(
    (row) => row.valor !== null && Number(row.valor) >= 0,
  );
  const visibleGroups = counts.filter((row) =>
    label(row[primary])
      .toLocaleLowerCase("es")
      .includes(groupSearch.toLocaleLowerCase("es")),
  );
  const groupPageCount = Math.max(1, Math.ceil(visibleGroups.length / 20));
  const pageGroups = visibleGroups.slice((groupPage - 1) * 20, groupPage * 20);

  function invalidateSummary() {
    setLoading(true);
    setSummary(null);
    setSummaryError("");
    setMatrixPage(1);
    setGroupPage(1);
  }

  function editCriteria(next) {
    invalidateSummary();
    setCriteria(next);
    setSelection(null);
    setDetail(null);
    setDetailPage(1);
  }
  function chooseCell(groups) {
    setSelection(groups);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    setDetailPage(1);
  }
  function changePrimary(value) {
    invalidateSummary();
    setPrimary(value);
    if (value === secondary)
      setSecondary(options.find((field) => field.name !== value)?.name ?? "");
    setSelection(null);
    setDetailPage(1);
  }
  function changeSecondary(value) {
    invalidateSummary();
    setSecondary(value);
    setSelection(null);
    setDetailPage(1);
  }
  function changeMetric(value) {
    invalidateSummary();
    setMetric(value);
    setSelection(null);
    setDetailPage(1);
  }
  const selectStyle = "report-select " + focusClass;
  const selected = selection
    ? selection
        .map((group) => `${fieldLabel(group.field)}: ${label(group.value)}`)
        .join(" · ")
    : "";

  return (
    <div className="report-scope">
      <AreaHeader
        label={config?.label ?? user?.categoria?.nombre_categoria ?? area}
      />
      <main id="main-content" className="report-main">
        <header className="report-hero">
          <div>
            <p className="report-eyebrow">IATECH / ANÁLISIS DE INVENTARIO</p>
            <h2>
              Reportes <span>{config?.label ?? "del área"}</span>
            </h2>
            <p>
              Explora distribuciones, cruza atributos y abre los registros de
              cada resultado.
            </p>
          </div>
          <div className="report-hero-meta">
            <span>ÁREA AUTORIZADA</span>
            <strong>{user?.categoria?.nombre_categoria}</strong>
          </div>
        </header>
        {configError && (
          <p role="alert" className="report-error">
            {configError}
          </p>
        )}
        {!config && !configError && (
          <p role="status" className="report-empty">
            Cargando configuración…
          </p>
        )}
        {config && !config.enabled && (
          <p className="report-empty">
            {config.reason}. Los reportes estarán disponibles al recibir el
            diccionario del área.
          </p>
        )}
        {config?.enabled && (
          <>
            <div className="report-layout">
              <aside
                className="report-controls"
                aria-label="Configuración del reporte"
              >
                <div className="report-controls-title">
                  <span>01</span>
                  <div>
                    <h3>Configurar análisis</h3>
                    <p>Selecciona qué comparar.</p>
                  </div>
                </div>
                <div
                  className="report-segments"
                  role="group"
                  aria-label="Modalidad del reporte"
                >
                  <button
                    type="button"
                    aria-pressed={mode === "individual"}
                    className={focusClass}
                    onClick={() => {
                      invalidateSummary();
                      setMode("individual");
                      setSelection(null);
                    }}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "cross"}
                    className={focusClass}
                    disabled={!secondary}
                    onClick={() => {
                      invalidateSummary();
                      if (isDetailView)
                        setPrimary(
                          options.find((field) => field.name !== secondary)
                            ?.name ??
                            options[0]?.name ??
                            "",
                        );
                      setMode("cross");
                      setSelection(null);
                    }}
                  >
                    Cruzado
                  </button>
                </div>
                <label className="report-label">
                  {mode === "cross" ? "Filas" : "Atributo"}
                  <select
                    className={selectStyle}
                    value={primary}
                    onChange={(event) => changePrimary(event.target.value)}
                  >
                    <optgroup label="Agrupar y visualizar">
                      {options.map((field) => (
                        <option value={field.name} key={field.name}>
                          {fieldLabel(field.name)}
                        </option>
                      ))}
                    </optgroup>
                    {mode === "individual" && (
                      <optgroup label="Vista detallada">
                        {config.fields
                          .filter((field) => !groupable(field, config.id))
                          .map((field) => (
                            <option value={field.name} key={field.name}>
                              {fieldLabel(field.name)}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                {mode === "cross" && (
                  <div className="report-pair">
                    <label className="report-label">
                      Columnas
                      <select
                        className={selectStyle}
                        value={secondary}
                        onChange={(event) =>
                          changeSecondary(event.target.value)
                        }
                      >
                        {options
                          .filter((field) => field.name !== primary)
                          .map((field) => (
                            <option value={field.name} key={field.name}>
                              {fieldLabel(field.name)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className={"report-swap " + focusClass}
                      onClick={() => {
                        invalidateSummary();
                        setPrimary(secondary);
                        setSecondary(primary);
                        setSelection(null);
                      }}
                      aria-label="Intercambiar filas y columnas"
                    >
                      ⇄ <span>Intercambiar</span>
                    </button>
                  </div>
                )}
                {isDateView && (
                  <label className="report-label">
                    Período
                    <select
                      className={selectStyle}
                      value={period}
                      onChange={(event) => {
                        invalidateSummary();
                        setPeriod(event.target.value);
                        setSelection(null);
                      }}
                    >
                      <option value="day">Día</option>
                      <option value="month">Mes</option>
                      <option value="year">Año</option>
                    </select>
                  </label>
                )}
                {!isDetailView && (
                  <label className="report-label">
                    Métrica
                    <select
                      className={selectStyle}
                      value={metric}
                      onChange={(event) => changeMetric(event.target.value)}
                    >
                      <option value="count">Cantidad de registros</option>
                      {measureField && (
                        <>
                          <option value="sum">
                            Suma de {fieldLabel(measureField.name)}
                          </option>
                          <option value="avg">
                            Promedio de {fieldLabel(measureField.name)}
                          </option>
                          <option value="min">
                            Mínimo de {fieldLabel(measureField.name)}
                          </option>
                          <option value="max">
                            Máximo de {fieldLabel(measureField.name)}
                          </option>
                        </>
                      )}
                    </select>
                  </label>
                )}
                <div className="report-filter-head">
                  <span>02</span>
                  <div>
                    <h3>Acotar resultados</h3>
                    <p>Los filtros afectan a todas las vistas.</p>
                  </div>
                </div>
                <InventoryFilters
                  fields={config.fields}
                  criteria={criteria}
                  onChange={editCriteria}
                />
                {(criteria.q || active.length > 0) && (
                  <div className="report-active" aria-label="Filtros activos">
                    <h4>Filtros activos</h4>
                    {criteria.q && (
                      <button
                        type="button"
                        className={focusClass}
                        onClick={() =>
                          editCriteria({ ...criteria, q: "", page: 1 })
                        }
                      >
                        Búsqueda: {criteria.q} ×
                      </button>
                    )}
                    {active.map((filter, index) => (
                      <button
                        type="button"
                        className={focusClass}
                        key={index}
                        onClick={() =>
                          editCriteria({
                            ...criteria,
                            filters: criteria.filters.filter(
                              (candidate) => candidate !== filter,
                            ),
                            page: 1,
                          })
                        }
                      >
                        {fieldLabel(filter.column)}:{" "}
                        {["isNull", "notNull"].includes(filter.op)
                          ? filter.op === "isNull"
                            ? "NULL"
                            : "Con dato"
                          : filter.value}{" "}
                        ×
                      </button>
                    ))}
                  </div>
                )}
              </aside>
              <div className="report-results" aria-busy={loading}>
                <div className="report-results-head">
                  <div>
                    <p className="report-eyebrow">03 / RESULTADOS</p>
                    <h3>
                      {isDetailView
                        ? "Registros detallados"
                        : crossed
                          ? `${fieldLabel(primary)} × ${fieldLabel(secondary)}`
                          : fieldLabel(primary)}
                    </h3>
                    <p>
                      {isDetailView
                        ? "Consulta de registros originales"
                        : `${number.format(totalCount)} registros filtrados · ${number.format(counts.length)} ${crossed ? "combinaciones" : "grupos"}`}
                    </p>
                  </div>
                  {!isDetailView && (
                    <span className="report-metric-tag">
                      {metricText[metric]}
                      {measureField && metric !== "count" ? " · USD" : ""}
                    </span>
                  )}
                </div>
                {summaryError && (
                  <p role="alert" className="report-error">
                    {summaryError}
                  </p>
                )}
                {loading && (
                  <p role="status" className="report-empty">
                    Actualizando análisis…
                  </p>
                )}
                {!loading && summary && !isDetailView && (
                  <>
                    <div className="report-statline">
                      <span>
                        <strong>
                          {number.format(summary.grandTotal.cantidad)}
                        </strong>{" "}
                        registros
                      </span>
                      <span>
                        <strong>{number.format(counts.length)}</strong>{" "}
                        {crossed ? "combinaciones" : "grupos"}
                      </span>
                      <span>
                        <strong>
                          {formatMetric(summary.grandTotal.valor, metric)}
                        </strong>{" "}
                        {metricText[metric].toLowerCase()} general
                      </span>
                    </div>
                    {summary.note && (
                      <p className="report-note">{summary.note}</p>
                    )}
                    {!counts.length && (
                      <p className="report-empty">
                        No hay registros con los filtros actuales. Ajusta la
                        búsqueda o elimina algún filtro.
                      </p>
                    )}
                  </>
                )}
                {!loading && grouped && counts.length > 0 && (
                  <>
                    <div className="report-viewbar">
                      <div role="group" aria-label="Vista individual">
                        <button
                          type="button"
                          aria-pressed={
                            individualView === "visual" && visualAllowed
                          }
                          className={focusClass}
                          disabled={!visualAllowed}
                          onClick={() => setIndividualView("visual")}
                        >
                          Visual
                        </button>
                        <button
                          type="button"
                          aria-pressed={
                            individualView === "values" || !visualAllowed
                          }
                          className={focusClass}
                          onClick={() => setIndividualView("values")}
                        >
                          Valores exactos
                        </button>
                      </div>
                      <p>{note}</p>
                    </div>
                    {!visualAllowed && (
                      <p className="report-note">
                        Este resultado contiene valores nulos o negativos.
                        Consulta “Valores exactos” para no confundirlos con
                        cero.
                      </p>
                    )}
                    {individualView === "visual" && visualAllowed ? (
                      <div
                        className="report-chart"
                        aria-label={
                          fieldType(selectedField)
                            ? "Serie temporal"
                            : "Comparación por categoría"
                        }
                      >
                        {fieldType(selectedField) ? (
                          <div className="report-timeline">
                            {counts.slice(0, 36).map((row) => (
                              <button
                                type="button"
                                className={"report-timepoint " + focusClass}
                                key={key(row[primary])}
                                onClick={() =>
                                  chooseCell([
                                    { field: primary, value: row[primary] },
                                  ])
                                }
                                aria-label={`${label(row[primary])}: ${formatMetric(row.valor, metric)}. Ver registros`}
                              >
                                <span
                                  className="report-timebar"
                                  style={{
                                    height: `${Math.max(3, (Number(row.valor ?? 0) / Math.max(1, ...counts.map((item) => Number(item.valor ?? 0)))) * 100)}%`,
                                  }}
                                />
                                <span>{label(row[primary])}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          counts.slice(0, 16).map((row) => (
                            <button
                              type="button"
                              className={"report-bar " + focusClass}
                              key={key(row[primary])}
                              onClick={() =>
                                chooseCell([
                                  { field: primary, value: row[primary] },
                                ])
                              }
                              aria-label={`${label(row[primary])}: ${formatMetric(row.valor, metric)}. Ver registros`}
                            >
                              <span className="report-bar-label">
                                {label(row[primary])}
                              </span>
                              <span className="report-bar-track">
                                <span
                                  style={{
                                    width: `${Math.max(0, (Number(row.valor ?? 0) / Math.max(1, ...counts.map((item) => Number(item.valor ?? 0)))) * 100)}%`,
                                  }}
                                />
                              </span>
                              <strong>{formatMetric(row.valor, metric)}</strong>
                            </button>
                          ))
                        )}
                        {counts.length >
                          (fieldType(selectedField) ? 36 : 16) && (
                          <p className="report-chart-note">
                            Se visualizan {fieldType(selectedField) ? 36 : 16}{" "}
                            de {counts.length} grupos. Usa “Valores exactos”
                            para consultar todos.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="report-matrix-tools">
                          <label>
                            Buscar grupo
                            <input
                              type="search"
                              value={groupSearch}
                              onChange={(event) => {
                                setGroupSearch(event.target.value);
                                setGroupPage(1);
                              }}
                              placeholder={fieldLabel(primary)}
                              className={selectStyle}
                            />
                          </label>
                        </div>
                        <p className="report-matrix-caption">
                          {pageGroups.length} grupos visibles de{" "}
                          {visibleGroups.length} coincidentes; total general de
                          todos los registros filtrados.
                        </p>
                        <div className="report-table-scroll">
                          <table className="report-table">
                            <thead>
                              <tr>
                                <th scope="col">{fieldLabel(primary)}</th>
                                <th scope="col">{metricText[metric]}</th>
                                <th scope="col">Registros</th>
                                <th scope="col">% del total general</th>
                                <th scope="col">Detalle</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageGroups.map((row) => (
                                <tr key={key(row[primary])}>
                                  <th scope="row">{label(row[primary])}</th>
                                  <td>{formatMetric(row.valor, metric)}</td>
                                  <td>{number.format(row.cantidad)}</td>
                                  <td>
                                    {totalCount
                                      ? percent.format(
                                          row.cantidad / totalCount,
                                        )
                                      : "—"}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className={
                                        "report-detail-link " + focusClass
                                      }
                                      onClick={() =>
                                        chooseCell([
                                          {
                                            field: primary,
                                            value: row[primary],
                                          },
                                        ])
                                      }
                                    >
                                      Ver registros
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <th scope="row">Total general</th>
                                <td>
                                  {formatMetric(
                                    summary.grandTotal.valor,
                                    metric,
                                  )}
                                </td>
                                <td>{number.format(totalCount)}</td>
                                <td>{totalCount ? "100 %" : "—"}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {groupPageCount > 1 && (
                          <div className="report-pagination">
                            <button
                              type="button"
                              className={focusClass}
                              disabled={groupPage <= 1}
                              onClick={() => setGroupPage(groupPage - 1)}
                            >
                              Anterior
                            </button>
                            <span>
                              Grupos: página {groupPage} de {groupPageCount}
                            </span>
                            <button
                              type="button"
                              className={focusClass}
                              disabled={groupPage >= groupPageCount}
                              onClick={() => setGroupPage(groupPage + 1)}
                            >
                              Siguiente
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {!loading && crossed && counts.length > 0 && (
                  <>
                    <div className="report-viewbar">
                      <div role="group" aria-label="Vista cruzada">
                        <button
                          type="button"
                          aria-pressed={
                            crossView === "matrix" || !crossChartPossible
                          }
                          className={focusClass}
                          onClick={() => setCrossView("matrix")}
                        >
                          Matriz
                        </button>
                        <button
                          type="button"
                          aria-pressed={
                            crossView === "chart" && crossChartPossible
                          }
                          className={focusClass}
                          disabled={!crossChartPossible}
                          onClick={() => setCrossView("chart")}
                        >
                          Comparar barras
                        </button>
                      </div>
                      <p>{note}</p>
                    </div>
                    {crossView === "chart" && crossChartPossible ? (
                      <div
                        className="report-chart"
                        aria-label="Barras comparativas del cruce"
                      >
                        <div className="report-legend">
                          {allColumns.map((column, index) => (
                            <span key={key(column[secondary])}>
                              <i
                                style={{
                                  background: `var(--report-series-${index})`,
                                }}
                              />
                              {label(column[secondary])}
                            </span>
                          ))}
                        </div>
                        {allRows.map((row) => (
                          <div
                            className="report-stack-row"
                            key={key(row[primary])}
                          >
                            <strong>{label(row[primary])}</strong>
                            <div className="report-stack-track">
                              {allColumns.map((column, index) => {
                                const item = cellMap.get(
                                  key([row[primary], column[secondary]]),
                                );
                                return (
                                  item && (
                                    <button
                                      type="button"
                                      key={key(column[secondary])}
                                      style={{
                                        width: `${(item.cantidad / Math.max(1, row.cantidad)) * 100}%`,
                                        background: `var(--report-series-${index})`,
                                      }}
                                      aria-label={`${label(row[primary])} y ${label(column[secondary])}: ${item.cantidad} registros. Ver detalle`}
                                      onClick={() =>
                                        chooseCell([
                                          {
                                            field: primary,
                                            value: row[primary],
                                          },
                                          {
                                            field: secondary,
                                            value: column[secondary],
                                          },
                                        ])
                                      }
                                    />
                                  )
                                );
                              })}
                            </div>
                            <span>{number.format(row.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {!crossChartPossible && (
                          <p className="report-note">
                            Para este cruce se muestra la matriz: conserva los
                            valores exactos sin comprimir demasiadas categorías
                            en un gráfico.
                          </p>
                        )}
                        <div className="report-matrix-tools">
                          <label>
                            Buscar filas
                            <input
                              type="search"
                              value={matrixSearch}
                              onChange={(event) => {
                                setMatrixSearch(event.target.value);
                                setMatrixPage(1);
                              }}
                              placeholder={fieldLabel(primary)}
                              className={selectStyle}
                            />
                          </label>
                          <label>
                            Buscar columnas
                            <input
                              type="search"
                              value={columnSearch}
                              onChange={(event) =>
                                setColumnSearch(event.target.value)
                              }
                              placeholder={fieldLabel(secondary)}
                              className={selectStyle}
                            />
                          </label>
                          <label>
                            Ordenar filas
                            <select
                              value={matrixSort}
                              onChange={(event) => {
                                setMatrixSort(event.target.value);
                                setMatrixPage(1);
                              }}
                              className={selectStyle}
                            >
                              <option value="domain">Orden natural</option>
                              <option value="count">Más registros</option>
                            </select>
                          </label>
                        </div>
                        <p className="report-matrix-caption">
                          {visibleRows.length} filas visibles de{" "}
                          {allRows.length}; {visibleColumns.length} columnas
                          visibles de {allColumns.length}. Los totales
                          corresponden a todos los registros filtrados. — =
                          combinación ausente; “Sin valor (NULL)” = combinación
                          existente sin métrica numérica.
                        </p>
                        <div className="report-table-scroll">
                          <table className="report-table report-matrix">
                            <thead>
                              <tr>
                                <th scope="col">
                                  {fieldLabel(primary)} /{" "}
                                  {fieldLabel(secondary)}
                                </th>
                                {visibleColumns.map((column) => (
                                  <th scope="col" key={key(column[secondary])}>
                                    {label(column[secondary])}
                                  </th>
                                ))}
                                <th scope="col">Total fila</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRows.map((row) => (
                                <tr key={key(row[primary])}>
                                  <th scope="row">{label(row[primary])}</th>
                                  {visibleColumns.map((column) => {
                                    const item = cellMap.get(
                                      key([row[primary], column[secondary]]),
                                    );
                                    return (
                                      <td key={key(column[secondary])}>
                                        {item ? (
                                          <button
                                            type="button"
                                            className={
                                              "report-cell " + focusClass
                                            }
                                            onClick={() =>
                                              chooseCell([
                                                {
                                                  field: primary,
                                                  value: row[primary],
                                                },
                                                {
                                                  field: secondary,
                                                  value: column[secondary],
                                                },
                                              ])
                                            }
                                            aria-label={`${label(row[primary])} y ${label(column[secondary])}: ${formatMetric(item.valor, metric)}. Ver registros`}
                                          >
                                            {formatMetric(item.valor, metric)}
                                          </button>
                                        ) : (
                                          <span
                                            className="report-absent"
                                            title="No existe esta combinación"
                                          >
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="report-total">
                                    {formatMetric(row.valor, metric)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <th scope="row">Total columna</th>
                                {visibleColumns.map((column) => (
                                  <td key={key(column[secondary])}>
                                    {formatMetric(column.valor, metric)}
                                  </td>
                                ))}
                                <td>
                                  {formatMetric(
                                    summary.grandTotal.valor,
                                    metric,
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        {!visibleRows.length && (
                          <p className="report-empty">
                            No hay filas que coincidan con la búsqueda.
                          </p>
                        )}
                        {pageCount > 1 && (
                          <div className="report-pagination">
                            <button
                              type="button"
                              className={focusClass}
                              disabled={matrixPage === 1}
                              onClick={() => setMatrixPage(matrixPage - 1)}
                            >
                              Anterior
                            </button>
                            <span>
                              Filas: página {matrixPage} de {pageCount}
                            </span>
                            <button
                              type="button"
                              className={focusClass}
                              disabled={matrixPage >= pageCount}
                              onClick={() => setMatrixPage(matrixPage + 1)}
                            >
                              Siguiente
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {!loading && summary?.mode === "detail" && (
                  <DetailTable
                    result={summary}
                    loading={false}
                    page={detailPage}
                    onPage={(page) => {
                      invalidateSummary();
                      setDetailPage(page);
                    }}
                    title={`Registros por ${fieldLabel(primary)}`}
                  />
                )}
                {selection && (
                  <div className="report-drilldown">
                    <div className="report-drill-head">
                      <div>
                        <p className="report-eyebrow">04 / DETALLE</p>
                        <h3>{selected}</h3>
                      </div>
                      <button
                        type="button"
                        className={focusClass}
                        onClick={() => setSelection(null)}
                      >
                        Cerrar detalle
                      </button>
                    </div>
                    <DetailTable
                      result={detail}
                      loading={detailLoading}
                      error={detailError}
                      page={detailPage}
                      onPage={(page) => {
                        setDetail(null);
                        setDetailError("");
                        setDetailLoading(true);
                        setDetailPage(page);
                      }}
                      title="Registros que componen este resultado"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
