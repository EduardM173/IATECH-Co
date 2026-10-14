import { useState } from "react";
import { inventoryImport, inventoryImportTemplate } from "../lib/api";

export default function InventoryImporter({
  config,
  area,
  token,
  onClose,
  onImported,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function upload(confirm = false) {
    setBusy(confirm ? "import" : "preview");
    setError("");
    try {
      const result = await inventoryImport(area, token, file, confirm);
      if (confirm) onImported(result.imported);
      else setPreview(result);
    } catch (err) {
      setError(err.message);
      if (!confirm) setPreview(null);
    } finally {
      setBusy("");
    }
  }
  async function template() {
    setBusy("template");
    setError("");
    try {
      const blob = await inventoryImportTemplate(area, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla-" + area + ".xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Importar Excel"
      className="inventory-import-card"
    >
      <div className="inventory-import-heading">
        <div>
          <p className="inventory-import-eyebrow">{config.label}</p>
          <h3>Importar desde Excel</h3>
          <p className="inventory-import-subtitle">
            Selecciona el archivo, revisa la validación y confirma las filas nuevas.
          </p>
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={onClose}
          className="inventory-button inventory-import-close"
        >
          Volver al inventario
        </button>
      </div>
      <p className="inventory-import-intro">
        <strong>Antes de importar</strong>
        <span>
          La primera fila debe contener los nombres exactos de las columnas. Usa
          la hoja Datos y fechas YYYY-MM-DD o fechas de Excel; no se admiten
          fórmulas.
        </span>
        <span>
          La importación agrega registros nuevos; no reemplaza los existentes.
          Los ID y las fechas automáticas se regeneran.
        </span>
      </p>
      <div className="inventory-file-section">
        <div className="inventory-import-section-heading">
          <div>
            <h4>1. Selecciona tu archivo</h4>
            <p>Elige un Excel para validar antes de incorporarlo.</p>
          </div>
          <span className="inventory-import-limits">.xlsx · Máx. 5 MB · 1000 filas</span>
        </div>
        <label className="inventory-file-row">
          <span className="inventory-file-icon" aria-hidden="true">XLSX</span>
          <span className="inventory-file-copy" aria-live="polite">
            <strong>{file ? file.name : "Ningún archivo seleccionado"}</strong>
            <small>{file ? "Archivo listo para validar" : "Selecciona un archivo .xlsx de hasta 5 MB"}</small>
          </span>
          <span className="inventory-file-action">{file ? "Cambiar archivo" : "Elegir archivo"}</span>
          <input
            type="file"
            accept=".xlsx"
            disabled={!!busy}
            aria-label="Seleccionar archivo Excel XLSX"
            className="inventory-file-input"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              setPreview(null);
              setError("");
              setFile(null);
              if (
                selected &&
                (!/\.xlsx$/i.test(selected.name) ||
                  selected.size > 5 * 1024 * 1024)
              )
                setError("Selecciona un archivo .xlsx de hasta 5 MB");
              else setFile(selected ?? null);
            }}
          />
        </label>
      </div>
      <div className="inventory-import-actions">
        <button
          type="button"
          disabled={!file || !!busy}
          onClick={() => upload()}
          aria-busy={busy === "preview"}
          className="inventory-button inventory-button-primary"
        >
          {busy === "preview" ? "Validando archivo…" : "Validar y ver vista previa"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={template}
          className="inventory-button"
        >
          {busy === "template" ? "Descargando…" : "Descargar plantilla"}
        </button>
      </div>
      {error && (
        <p role="alert" className="inventory-message">
          {error}
        </p>
      )}
      {preview && (
        <div className="inventory-import-results">
          <div className="inventory-import-section-heading">
            <div>
              <h4>2. Revisa el resultado</h4>
              <p>Comprueba los datos antes de confirmar la importación.</p>
            </div>
          </div>
          <p
            role="status"
            className="inventory-import-status"
            data-state={preview.canImport ? "ready" : "errors"}
          >
            {preview.total} registros ·{" "}
            {preview.canImport
              ? "Validación correcta. Listos para importar."
              : preview.errorCount +
                " errores. Corrige el archivo y vuelve a validarlo."}
          </p>
          {preview.ignoredColumns.length > 0 && (
            <p className="inventory-import-ignored">
              Columnas automáticas ignoradas:{" "}
              {preview.ignoredColumns.join(", ")}.
            </p>
          )}
          {preview.errors.length > 0 && (
            <div
              className="inventory-import-errors"
              role="alert"
            >
              <ul>
                {preview.errors.map((item, index) => (
                  <li key={index}>
                    <strong>Fila {item.row} · {item.column}</strong>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
              {preview.errorCount > preview.errors.length && (
                <p className="inventory-import-error-count">
                  Se muestran los primeros {preview.errors.length} errores.
                </p>
              )}
            </div>
          )}
          <p className="inventory-import-preview-note">
            Vista previa: primeros {preview.data.length} registros de{" "}
            {preview.total}. Las celdas vacías se guardan como NULL cuando la
            columna lo permite.
          </p>
          <div className="inventory-import-preview">
            <table className="inventory-import-table">
              <thead>
                <tr>
                  {preview.columns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap p-3 font-semibold"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    {preview.columns.map((column) => (
                      <td key={column} className="max-w-xs break-words p-3">
                        {row[column] === null
                          ? "Sin dato"
                          : row[column] === undefined
                            ? "Predeterminado"
                            : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inventory-import-confirm">
            <p>
              {preview.canImport
                ? `Se agregarán ${preview.total} registros nuevos. El inventario existente no se modificará.`
                : "Corrige los errores del archivo y vuelve a seleccionarlo para continuar."}
            </p>
            <button
              type="button"
              disabled={!preview.canImport || !!busy}
              onClick={() => upload(true)}
              aria-busy={busy === "import"}
              className="inventory-button inventory-button-primary"
            >
              {busy === "import"
                ? "Importando…"
                : "Confirmar e importar " + preview.total + " registros"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
