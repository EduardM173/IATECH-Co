import { AreaSlug } from './types/area-slug.type';

interface AreaConfig {
  nombreCategoria: string;
  searchableFields: string[];
}

// Mapeo explicito area -> categoria en BD + campos propios buscables del detalle.
// El nombre de cada clave coincide con el nombre de la relacion de detalle en el modelo
// Activo de Prisma (activo.hardware, activo.software, ...), asi que "area" sirve directo
// como clave de include/where sin necesitar una tabla de traduccion aparte.
export const AREA_CONFIG: Record<AreaSlug, AreaConfig> = {
  hardware: {
    nombreCategoria: 'HARDWARE',
    searchableFields: ['numero_serie', 'modelo', 'marca'],
  },
  software: {
    nombreCategoria: 'SOFTWARE',
    searchableFields: ['version', 'tipo_licencia'],
  },
  redes: {
    nombreCategoria: 'REDES',
    searchableFields: ['direccion_ip', 'tipo_conexion', 'ancho_banda'],
  },
  seguridad: {
    nombreCategoria: 'SEGURIDAD',
    searchableFields: ['tipo_seguridad', 'nivel_acceso', 'protocolo'],
  },
  calidad: {
    nombreCategoria: 'CALIDAD',
    searchableFields: ['norma_iso', 'certificacion'],
  },
  cloud: {
    nombreCategoria: 'CLOUD',
    searchableFields: ['proveedor', 'tipo_servicio', 'capacidad'],
  },
  bigdata: {
    nombreCategoria: 'BIG DATA ANALITICAS',
    searchableFields: ['herramienta', 'tipo_dato'],
  },
};
