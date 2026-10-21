// Columnas que acepta la carga masiva de cada área. Deben mantenerse alineadas con
// database/prisma/schema.prisma (Activo + tabla de detalle del área). Las claves del
// objeto coinciden con el parámetro :area de la ruta del dashboard.
const COMMON_COLUMNS = [
  { key: 'codigo', label: 'Código', type: 'codigo', required: true, maxLength: 20 },
  { key: 'descripcion', label: 'Descripción', type: 'text', required: true, maxLength: 255 },
  { key: 'estado', label: 'Estado', type: 'estado', maxLength: 20, hint: 'Vacío = ACTIVO' },
  { key: 'fecha_registro', label: 'Fecha de registro', type: 'date', hint: 'Vacío = hoy' },
]

export const KNOWN_ESTADOS = ['ACTIVO', 'INACTIVO', 'EN MANTENIMIENTO', 'PENDIENTE RENOVAR', 'DADO DE BAJA']

const text = (key, label, maxLength, required = false) => ({ key, label, type: 'text', maxLength, required })
const date = (key, label) => ({ key, label, type: 'date' })

export const IMPORT_AREAS = {
  hardware: {
    label: 'Hardware',
    prefix: 'HW',
    columns: [text('numero_serie', 'Número de serie', 50, true), text('modelo', 'Modelo', 50), text('marca', 'Marca', 50)],
  },
  software: {
    label: 'Software',
    prefix: 'SW',
    columns: [text('version', 'Versión', 20), text('tipo_licencia', 'Tipo de licencia', 50), date('fecha_expiracion', 'Fecha de expiración')],
  },
  redes: {
    label: 'Redes',
    prefix: 'RD',
    columns: [{ key: 'direccion_ip', label: 'Dirección IP', type: 'ip', maxLength: 45 }, text('tipo_conexion', 'Tipo de conexión', 50), text('ancho_banda', 'Ancho de banda', 30)],
  },
  seguridad: {
    label: 'Seguridad',
    prefix: 'SG',
    columns: [text('tipo_seguridad', 'Tipo de seguridad', 50), text('nivel_acceso', 'Nivel de acceso', 30), text('protocolo', 'Protocolo', 50)],
  },
  calidad: {
    label: 'Calidad',
    prefix: 'CL',
    columns: [text('norma_iso', 'Norma ISO', 30), text('certificacion', 'Certificación', 50), date('fecha_auditoria', 'Fecha de auditoría')],
  },
  cloud: {
    label: 'Cloud',
    prefix: 'CD',
    columns: [text('proveedor', 'Proveedor', 50), text('tipo_servicio', 'Tipo de servicio', 50), text('capacidad', 'Capacidad', 30)],
  },
  'big-data': {
    label: 'Big Data',
    prefix: 'BD',
    columns: [text('herramienta', 'Herramienta', 50), text('tipo_dato', 'Tipo de dato', 50), text('volumen_datos', 'Volumen de datos', 30)],
  },
}

export function getImportColumns(area) {
  const config = IMPORT_AREAS[area]
  return config ? [...COMMON_COLUMNS, ...config.columns] : []
}
