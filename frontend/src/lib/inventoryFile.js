import { getImportColumns, IMPORT_AREAS, KNOWN_ESTADOS } from './importColumns'

export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls']
export const MAX_FILE_SIZE = 5 * 1024 * 1024
export const MAX_ROWS = 1000

// SheetJS pesa bastante; se carga solo al entrar a la importación.
const loadXlsx = () => import('xlsx')

export class FileImportError extends Error {}

const normalizeHeader = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s\-.]+/g, '_')

export function formatFileSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function checkFile(file) {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!ACCEPTED_EXTENSIONS.includes(extension)) throw new FileImportError(`El archivo "${file.name}" no es CSV ni Excel. Usa un archivo .csv, .xlsx o .xls.`)
  if (file.size === 0) throw new FileImportError('El archivo está vacío.')
  if (file.size > MAX_FILE_SIZE) throw new FileImportError(`El archivo pesa ${formatFileSize(file.size)}; el máximo permitido es ${formatFileSize(MAX_FILE_SIZE)}.`)
  return extension
}

// Los CSV se leen como texto para no convertir valores como "5.40" o "10.10.1.1" en números.
// Si no es UTF-8 válido (CSV guardado desde Excel en Windows) se reintenta como Windows-1252.
async function decodeCsv(file) {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1252').decode(buffer)
  }
}

export async function readWorkbook(file) {
  const extension = checkFile(file)
  const XLSX = await loadXlsx()
  try {
    const workbook = extension === '.csv'
      ? XLSX.read(await decodeCsv(file), { type: 'string', raw: true })
      : XLSX.read(await file.arrayBuffer(), { type: 'array' })
    if (!workbook.SheetNames.length) throw new FileImportError('El archivo no contiene hojas.')
    return { workbook, sheetNames: workbook.SheetNames }
  } catch (err) {
    if (err instanceof FileImportError) throw err
    throw new FileImportError('No se pudo leer el archivo. Verifica que no esté dañado ni protegido con contraseña.')
  }
}

function toCellText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const pad = (n) => String(n).padStart(2, '0')

function parseDate(value, XLSX) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    return parsed ? buildDate(parsed.y, parsed.m, parsed.d) : null
  }
  const text = toCellText(value)
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (match) return buildDate(+match[1], +match[2], +match[3])
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (match) return buildDate(+match[3], +match[2], +match[1])
  return null
}

function buildDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  if (year < 1950 || year > 2100) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const IPV6 = /^[0-9a-f:]+$/i
const isIp = (value) => IPV4.test(value) || (value.includes(':') && IPV6.test(value) && value.split('::').length <= 2)

function validateCell(column, rawValue, XLSX) {
  const text = toCellText(rawValue)
  if (!text) {
    if (column.required) return { error: 'Campo obligatorio' }
    if (column.key === 'estado') return { value: 'ACTIVO' }
    return { value: null }
  }
  if (column.type === 'date') {
    const date = parseDate(rawValue, XLSX)
    return date ? { value: date } : { value: text, error: 'Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)' }
  }
  const value = column.type === 'estado' || column.type === 'codigo' ? text.toUpperCase() : text
  if (column.maxLength && value.length > column.maxLength) return { value, error: `Máximo ${column.maxLength} caracteres (tiene ${value.length})` }
  if (column.type === 'ip' && !isIp(value)) return { value, error: 'Dirección IP inválida' }
  if (column.type === 'estado' && !KNOWN_ESTADOS.includes(value)) return { value, warning: 'Estado no habitual; revisa que esté bien escrito' }
  return { value }
}

// Convierte una hoja en filas validadas. Devuelve problemas del archivo completo
// (columnas faltantes, hoja vacía...) por separado de los errores de cada fila.
export async function parseSheet(workbook, sheetName, area) {
  const XLSX = await loadXlsx()
  const columns = getImportColumns(area)
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '', blankrows: false })
  const headerIndex = matrix.findIndex((row) => row.some((cell) => toCellText(cell)))
  if (headerIndex === -1) return { columns, rows: [], missingColumns: [], ignoredColumns: [], fileError: 'La hoja seleccionada no tiene datos.' }

  const lookup = new Map(columns.flatMap((column) => [[normalizeHeader(column.key), column.key], [normalizeHeader(column.label), column.key]]))
  const positions = {}
  const ignoredColumns = []
  matrix[headerIndex].forEach((header, index) => {
    const key = lookup.get(normalizeHeader(header))
    if (key && positions[key] === undefined) positions[key] = index
    else if (toCellText(header)) ignoredColumns.push(toCellText(header))
  })
  const missingColumns = columns.filter((column) => column.required && positions[column.key] === undefined)

  // Un archivo sin ninguna columna propia del área pero con las de otra área se rechaza,
  // aunque esas columnas sean opcionales, para no cargar activos en el área equivocada.
  const hasOwnColumns = IMPORT_AREAS[area].columns.some((column) => positions[column.key] !== undefined)
  if (!hasOwnColumns && ignoredColumns.length) {
    const ignored = new Set(ignoredColumns.map(normalizeHeader))
    const otherArea = Object.entries(IMPORT_AREAS).find(([slug, config]) => slug !== area && config.columns.some((column) => ignored.has(normalizeHeader(column.key)) || ignored.has(normalizeHeader(column.label))))
    if (otherArea) {
      return { columns, rows: [], missingColumns: [], ignoredColumns, fileError: `Este archivo tiene la estructura de ${otherArea[1].label}, no de ${IMPORT_AREAS[area].label}. Usa la plantilla de esta área o cárgalo desde el inventario de ${otherArea[1].label}.` }
    }
  }

  const dataRows = matrix.slice(headerIndex + 1)
    .map((cells, offset) => ({ cells, rowNumber: headerIndex + offset + 2 }))
    .filter(({ cells }) => cells.some((cell) => toCellText(cell)))

  if (!dataRows.length) return { columns, rows: [], missingColumns, ignoredColumns, fileError: 'El archivo tiene encabezados pero ninguna fila con datos.' }
  if (dataRows.length > MAX_ROWS) return { columns, rows: [], missingColumns, ignoredColumns, fileError: `El archivo tiene ${dataRows.length} filas; el máximo por carga es ${MAX_ROWS}. Divídelo en varios archivos.` }

  const prefix = IMPORT_AREAS[area]?.prefix
  const rows = dataRows.map(({ cells, rowNumber }) => {
    const row = { rowNumber, values: {}, errors: {}, warnings: {} }
    for (const column of columns) {
      const position = positions[column.key]
      const result = validateCell(column, position === undefined ? '' : cells[position], XLSX)
      row.values[column.key] = result.value ?? null
      if (result.error) row.errors[column.key] = result.error
      if (result.warning) row.warnings[column.key] = result.warning
    }
    const codigo = row.values.codigo
    if (codigo && !row.errors.codigo && prefix && !codigo.startsWith(`${prefix}-`)) row.warnings.codigo = `Los códigos de esta área suelen empezar con ${prefix}-`
    return row
  })

  const byCodigo = new Map()
  for (const row of rows) {
    const codigo = row.values.codigo
    if (!codigo || row.errors.codigo) continue
    byCodigo.set(codigo, [...(byCodigo.get(codigo) ?? []), row])
  }
  for (const [codigo, repeated] of byCodigo) {
    if (repeated.length < 2) continue
    for (const row of repeated) {
      const others = repeated.filter((other) => other !== row).map((other) => other.rowNumber).join(', ')
      row.errors.codigo = `Código ${codigo} repetido en la fila ${others}`
    }
  }

  for (const row of rows) {
    row.hasErrors = Object.keys(row.errors).length > 0
    row.hasWarnings = Object.keys(row.warnings).length > 0
  }
  return { columns, rows, missingColumns, ignoredColumns, fileError: '' }
}

export async function downloadTemplate(area, format) {
  const XLSX = await loadXlsx()
  const columns = getImportColumns(area)
  const sheet = XLSX.utils.aoa_to_sheet([columns.map((column) => column.key)])
  sheet['!cols'] = columns.map((column) => ({ wch: Math.max(column.key.length, column.label.length) + 4 }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Activos')
  XLSX.writeFile(workbook, `plantilla-${area}.${format}`, { bookType: format })
}

// Exporta las filas con errores junto a su motivo para que el usuario las corrija y las vuelva a cargar.
export async function downloadErrorReport(area, columns, rows) {
  const XLSX = await loadXlsx()
  const header = ['fila_original', ...columns.map((column) => column.key), 'errores']
  const body = rows.filter((row) => row.hasErrors).map((row) => [
    row.rowNumber,
    ...columns.map((column) => row.values[column.key] ?? ''),
    Object.entries(row.errors).map(([key, message]) => `${columns.find((column) => column.key === key)?.label ?? key}: ${message}`).join(' | '),
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, ...body]), 'Errores')
  XLSX.writeFile(workbook, `errores-importacion-${area}.xlsx`)
}

export function buildImportPayload(rows) {
  return rows.filter((row) => !row.hasErrors).map((row) => ({ ...row.values }))
}
