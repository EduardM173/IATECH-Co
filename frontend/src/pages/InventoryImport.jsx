import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import AreaHeader from '../components/AreaHeader'
import { useAuth } from '../context/useAuth'
import { getAreaRoute } from '../lib/areas'
import { getImportColumns, IMPORT_AREAS } from '../lib/importColumns'
import {
  ACCEPTED_EXTENSIONS, buildImportPayload, downloadErrorReport, downloadTemplate, FileImportError,
  formatFileSize, MAX_FILE_SIZE, MAX_ROWS, parseSheet, readWorkbook,
} from '../lib/inventoryFile'

const AREA_LABELS = {
  hardware: 'Hardware', software: 'Software', redes: 'Redes', seguridad: 'Seguridad',
  calidad: 'Calidad', cloud: 'Cloud', 'big-data': 'Big Data',
}
const PAGE_SIZE = 25
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50'

const Icon = ({ path, className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{path}</svg>
)
const UploadIcon = (props) => <Icon {...props} path={<><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>} />
const FileIcon = (props) => <Icon {...props} path={<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>} />
const DownloadIcon = (props) => <Icon {...props} path={<><path d="M12 4v12m0 0-4-4m4 4 4-4" /><path d="M4 20h16" /></>} />
const CheckIcon = (props) => <Icon {...props} path={<path d="m5 12 5 5L20 7" />} />
const AlertIcon = (props) => <Icon {...props} path={<><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" /></>} />

const STEPS = ['Archivo', 'Revisión', 'Confirmación']

function Stepper({ current }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Pasos de la importación">
      {STEPS.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'next'
        return (
          <li key={step} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${state === 'done' ? 'bg-rose-600 text-white' : state === 'current' ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-600' : 'bg-slate-100 text-slate-400'}`}>
              {state === 'done' ? <CheckIcon className="h-4 w-4" /> : index + 1}
            </span>
            <span className={state === 'next' ? 'text-slate-400' : 'font-medium text-slate-700'}>{step}</span>
            {index < STEPS.length - 1 && <span className={`mx-1 h-px w-8 sm:w-12 ${index < current ? 'bg-rose-600' : 'bg-slate-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

function Dropzone({ onFile, reading }) {
  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files) {
    if (files?.length) onFile(files[0], files.length > 1)
  }

  return (
    <div
      onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDragging(true) }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
      onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!reading) handleFiles(event.dataTransfer.files) }}
      className={`relative flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'scale-[1.01] border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50/60 hover:border-rose-400 hover:bg-rose-50/40'}`}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(',')} className="sr-only" tabIndex={-1} onChange={(event) => { handleFiles(event.target.files); event.target.value = '' }} />
      {reading ? (
        <div role="status" className="flex flex-col items-center gap-4">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-rose-100 border-t-rose-600" />
          <p className="font-medium text-slate-700">Leyendo y validando el archivo…</p>
        </div>
      ) : (
        <>
          <span className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm transition ${dragging ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 ring-1 ring-slate-200'}`}>
            <UploadIcon className="h-8 w-8" />
          </span>
          <p className="text-lg font-semibold text-slate-800">{dragging ? 'Suelta el archivo para cargarlo' : 'Arrastra tu archivo aquí'}</p>
          <p className="mt-1 text-sm text-slate-500">o</p>
          <button type="button" onClick={() => inputRef.current?.click()} className={`mt-3 ${primaryClass}`}>
            <FileIcon className="h-4 w-4" /> Seleccionar archivo
          </button>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            {['CSV', 'XLSX', 'XLS'].map((format) => <span key={format} className="rounded-full bg-white px-2.5 py-1 font-medium ring-1 ring-slate-200">{format}</span>)}
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Máx. {formatFileSize(MAX_FILE_SIZE)}</span>
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Hasta {MAX_ROWS} filas</span>
          </div>
        </>
      )}
    </div>
  )
}

function ColumnGuide({ area, columns }) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold">Columnas del archivo</h3>
      <p className="mt-1 text-sm text-slate-500">La primera fila debe tener estos encabezados. Puedes usar el nombre técnico o el visible; el orden no importa.</p>
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {columns.map((column) => (
          <li key={column.key} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <p className="font-mono text-xs text-slate-700">{column.key}</p>
              <p className="text-xs text-slate-500">{column.label}{column.type === 'date' ? ' · fecha' : column.type === 'ip' ? ' · IPv4/IPv6' : ''}{column.hint ? ` · ${column.hint}` : ''}</p>
            </div>
            {column.required
              ? <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Obligatorio</span>
              : <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Opcional</span>}
          </li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => downloadTemplate(area, 'xlsx')} className={buttonClass}><DownloadIcon className="h-4 w-4" /> Plantilla Excel</button>
        <button type="button" onClick={() => downloadTemplate(area, 'csv')} className={buttonClass}><DownloadIcon className="h-4 w-4" /> Plantilla CSV</button>
      </div>
    </aside>
  )
}

function StatCard({ label, value, tone, note, active, onClick }) {
  const tones = { slate: 'text-slate-800', emerald: 'text-emerald-700', rose: 'text-rose-700', amber: 'text-amber-700' }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-rose-300 ${active ? 'border-rose-500 ring-2 ring-rose-100' : 'border-slate-200'}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </button>
  )
}

function CellValue({ row, column }) {
  const error = row.errors[column.key]
  const warning = row.warnings[column.key]
  const value = row.values[column.key]
  const empty = value === null || value === ''
  return (
    <td className={`max-w-64 px-4 py-3 align-top ${error ? 'bg-rose-50' : warning ? 'bg-amber-50' : ''}`}>
      {empty
        ? <span className={error ? 'italic text-rose-400' : 'text-slate-300'}>{error ? 'vacío' : column.key === 'fecha_registro' ? <span className="italic text-slate-400">hoy</span> : '—'}</span>
        : <span className={`break-words ${column.key === 'codigo' ? 'font-mono' : ''} ${error ? 'text-rose-800' : ''}`}>{value}</span>}
      {(error || warning) && <p className={`mt-1 flex items-start gap-1 text-xs ${error ? 'text-rose-700' : 'text-amber-800'}`}><AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />{error || warning}</p>}
    </td>
  )
}

function ConfirmDialog({ open, onCancel, onConfirm, label, fileName, validCount, skippedCount, warningCount }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); onCancel() }} aria-labelledby="confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><UploadIcon className="h-6 w-6" /></span>
        <h2 id="confirm-title" className="mt-4 text-xl font-bold">¿Confirmar importación?</h2>
        <p className="mt-1 text-sm text-slate-500">Revisa el resumen antes de continuar.</p>
        <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Área</dt><dd className="font-medium">{label}</dd></div>
          <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Archivo</dt><dd className="truncate font-medium">{fileName}</dd></div>
          <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Activos a importar</dt><dd className="font-bold text-emerald-700">{validCount}</dd></div>
          {skippedCount > 0 && <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Filas con errores (se omiten)</dt><dd className="font-bold text-rose-700">{skippedCount}</dd></div>}
          {warningCount > 0 && <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">Filas con advertencias (se incluyen)</dt><dd className="font-bold text-amber-700">{warningCount}</dd></div>}
        </dl>
        {skippedCount > 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Las {skippedCount} filas con errores no se cargarán. Puedes descargarlas, corregirlas e importarlas después.</p>}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={buttonClass}>Volver a revisar</button>
        <button type="button" autoFocus onClick={onConfirm} className={primaryClass}>Importar {validCount} {validCount === 1 ? 'activo' : 'activos'}</button>
      </div>
    </dialog>
  )
}

export default function InventoryImport() {
  const { area } = useParams()
  const { user } = useAuth()
  const ownRoute = getAreaRoute(user?.categoria?.nombre_categoria)
  const columns = useMemo(() => getImportColumns(area), [area])

  const [stage, setStage] = useState('select')
  const [file, setFile] = useState(null)
  const [workbook, setWorkbook] = useState(null)
  const [sheetNames, setSheetNames] = useState([])
  const [sheetName, setSheetName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('todas')
  const [page, setPage] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  // Evita que el navegador abra el archivo si se suelta fuera de la zona de carga.
  useEffect(() => {
    const prevent = (event) => event.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent) }
  }, [])

  const rows = useMemo(() => parsed?.rows ?? [], [parsed])
  const counts = useMemo(() => ({
    total: rows.length,
    valid: rows.filter((row) => !row.hasErrors).length,
    errors: rows.filter((row) => row.hasErrors).length,
    warnings: rows.filter((row) => !row.hasErrors && row.hasWarnings).length,
  }), [rows])
  const filteredRows = useMemo(() => rows.filter((row) => (
    filter === 'errores' ? row.hasErrors : filter === 'validas' ? !row.hasErrors : filter === 'advertencias' ? !row.hasErrors && row.hasWarnings : true
  )), [rows, filter])

  if (ownRoute !== `/dashboard/${area}`) return <Navigate to={`${ownRoute}/importar`} replace />
  if (!IMPORT_AREAS[area]) return <Navigate to={ownRoute} replace />

  const label = AREA_LABELS[area] ?? area
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const blocked = Boolean(parsed?.fileError) || parsed?.missingColumns.length > 0

  async function loadSheet(book, name) {
    setParsed(await parseSheet(book, name, area))
    setSheetName(name)
    setFilter('todas')
    setPage(1)
  }

  async function handleFile(selected, multiple) {
    setError('')
    setNotice(multiple ? `Se seleccionaron varios archivos; solo se usará "${selected.name}".` : '')
    setStage('reading')
    try {
      const result = await readWorkbook(selected)
      setFile(selected)
      setWorkbook(result.workbook)
      setSheetNames(result.sheetNames)
      await loadSheet(result.workbook, result.sheetNames[0])
      setStage('review')
    } catch (err) {
      setError(err instanceof FileImportError ? err.message : 'Ocurrió un error inesperado al leer el archivo.')
      setStage('select')
    }
  }

  function reset() {
    setStage('select'); setFile(null); setWorkbook(null); setSheetNames([]); setSheetName('')
    setParsed(null); setNotice(''); setError(''); setConfirmOpen(false)
  }

  function confirmImport() {
    const payload = buildImportPayload(rows)
    // TODO: enviar `payload` al backend cuando exista el endpoint de importación
    // (p. ej. POST /activos/:area/importar). Cada elemento tiene las claves de getImportColumns(area).
    setImportedCount(payload.length)
    setConfirmOpen(false)
    setStage('done')
  }

  function changeFilter(next) {
    setFilter((current) => (current === next ? 'todas' : next))
    setPage(1)
  }

  const step = stage === 'done' ? 3 : stage === 'review' ? (confirmOpen ? 2 : 1) : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AreaHeader label={label} />

      <main className="mx-auto max-w-7xl p-6 md:p-8">
        <Link to={ownRoute} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rose-700">← Volver al inventario</Link>

        <section className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold">Importar activos de {label}</h2>
            <p className="mt-1 text-sm text-slate-500">Carga varios activos a la vez desde un archivo CSV o Excel. Revisarás cada fila antes de confirmar.</p>
          </div>
          <Stepper current={step} />
        </section>

        {(stage === 'select' || stage === 'reading') && (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {error && (
                <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div><p className="font-semibold">No se pudo cargar el archivo</p><p className="mt-0.5">{error}</p></div>
                </div>
              )}
              <Dropzone onFile={handleFile} reading={stage === 'reading'} />
              <p className="mt-4 text-xs text-slate-500">El archivo se procesa en tu navegador; nada se guarda hasta que confirmes la importación.</p>
            </section>
            <ColumnGuide area={area} columns={columns} />
          </div>
        )}

        {stage === 'review' && parsed && (
          <>
            <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><FileIcon /></span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{file?.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file?.size ?? 0)}{sheetNames.length > 1 ? ` · ${sheetNames.length} hojas` : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {sheetNames.length > 1 && (
                  <label className="flex items-center gap-2 text-sm text-slate-600">Hoja
                    <select value={sheetName} onChange={(event) => loadSheet(workbook, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100">
                      {sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" onClick={reset} className={buttonClass}>Cambiar archivo</button>
              </div>
            </section>

            {notice && <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">{notice}</p>}

            {blocked ? (
              <section role="alert" className="rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><AlertIcon className="h-7 w-7" /></span>
                <h3 className="mt-4 text-lg font-semibold">El archivo no tiene el formato esperado</h3>
                {parsed.fileError && <p className="mt-2 text-sm text-slate-600">{parsed.fileError}</p>}
                {parsed.missingColumns.length > 0 && (
                  <div className="mt-3 text-sm text-slate-600">
                    <p>Faltan columnas obligatorias:</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {parsed.missingColumns.map((column) => <span key={column.key} className="rounded-full bg-rose-50 px-3 py-1 font-mono text-xs font-medium text-rose-700">{column.key}</span>)}
                    </div>
                  </div>
                )}
                <p className="mt-4 text-sm text-slate-500">Descarga la plantilla, copia tus datos en ella y vuelve a intentarlo.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => downloadTemplate(area, 'xlsx')} className={buttonClass}><DownloadIcon className="h-4 w-4" /> Plantilla Excel</button>
                  <button type="button" onClick={reset} className={primaryClass}>Elegir otro archivo</button>
                </div>
              </section>
            ) : (
              <>
                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Filas leídas" value={counts.total} tone="slate" note="Sin contar encabezados ni filas vacías" active={filter === 'todas'} onClick={() => changeFilter('todas')} />
                  <StatCard label="Listas para importar" value={counts.valid} tone="emerald" note="Sin errores" active={filter === 'validas'} onClick={() => changeFilter('validas')} />
                  <StatCard label="Con errores" value={counts.errors} tone="rose" note="No se importarán" active={filter === 'errores'} onClick={() => changeFilter('errores')} />
                  <StatCard label="Con advertencias" value={counts.warnings} tone="amber" note="Se importarán; conviene revisar" active={filter === 'advertencias'} onClick={() => changeFilter('advertencias')} />
                </div>

                {parsed.ignoredColumns.length > 0 && (
                  <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Se ignorarán columnas que no pertenecen a {label}: <strong>{parsed.ignoredColumns.join(', ')}</strong>.</span>
                  </p>
                )}

                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <div>
                      <h3 className="font-semibold">Vista previa</h3>
                      <p className="text-sm text-slate-500">Así se registrarán los datos. Las celdas marcadas indican qué corregir.</p>
                    </div>
                    {counts.errors > 0 && (
                      <button type="button" onClick={() => downloadErrorReport(area, columns, rows)} className={buttonClass}><DownloadIcon className="h-4 w-4" /> Descargar filas con errores</button>
                    )}
                  </div>

                  <div className="max-h-[34rem] overflow-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[0_1px_0_0_var(--color-slate-200)]">
                        <tr>
                          <th scope="col" className="whitespace-nowrap px-4 py-3">Fila</th>
                          <th scope="col" className="whitespace-nowrap px-4 py-3">Estado de validación</th>
                          {columns.map((column) => (
                            <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3">
                              {column.label}{column.required && <span className="ml-0.5 text-rose-600" aria-label="obligatorio">*</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row) => (
                          <tr key={row.rowNumber} className="border-b border-slate-100 hover:bg-slate-50/70">
                            <td className="px-4 py-3 align-top font-mono text-xs text-slate-400">{row.rowNumber}</td>
                            <td className="px-4 py-3 align-top">
                              {row.hasErrors
                                ? <span className="inline-flex whitespace-nowrap rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">{Object.keys(row.errors).length} {Object.keys(row.errors).length === 1 ? 'error' : 'errores'}</span>
                                : row.hasWarnings
                                  ? <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Revisar</span>
                                  : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"><CheckIcon className="h-3.5 w-3.5" /> Lista</span>}
                            </td>
                            {columns.map((column) => <CellValue key={column.key} row={row} column={column} />)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibleRows.length && <p className="p-8 text-center text-sm text-slate-500">No hay filas en esta categoría.</p>}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
                      <p>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} de {filteredRows.length} filas</p>
                      <div className="flex items-center gap-3">
                        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className={buttonClass}>Anterior</button>
                        <span aria-live="polite">Página {page} de {totalPages}</span>
                        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={buttonClass}>Siguiente</button>
                      </div>
                    </div>
                  )}
                </section>

                <div className="sticky bottom-0 mt-6 -mx-6 border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur md:-mx-8 md:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">
                      {counts.valid === 0
                        ? <span className="font-medium text-rose-700">Ninguna fila está lista. Corrige el archivo y vuelve a cargarlo.</span>
                        : <>Se importarán <strong className="text-emerald-700">{counts.valid}</strong> de {counts.total} filas{counts.errors > 0 && <> · <strong className="text-rose-700">{counts.errors}</strong> se omitirán</>}.</>}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={reset} className={buttonClass}>Cancelar</button>
                      <button type="button" disabled={counts.valid === 0} onClick={() => setConfirmOpen(true)} className={primaryClass}>Continuar</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {stage === 'done' && (
          <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50"><CheckIcon className="h-8 w-8" /></span>
            <h3 className="mt-5 text-xl font-bold">{importedCount} {importedCount === 1 ? 'activo listo' : 'activos listos'} para importar</h3>
            <p className="mt-2 text-sm text-slate-500">Los datos de <strong>{file?.name}</strong> pasaron la validación. El registro en la base de datos se habilitará cuando el servidor admita importaciones.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={reset} className={buttonClass}>Importar otro archivo</button>
              <Link to={ownRoute} className={primaryClass}>Volver al inventario</Link>
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmImport}
        label={label}
        fileName={file?.name}
        validCount={counts.valid}
        skippedCount={counts.errors}
        warningCount={counts.warnings}
      />
    </div>
  )
}
