import { AreaSlug } from './types/area-slug.type';

interface AreaConfig {
  nombreCategoria: string;
  detailFields: string[];
  searchableFields: string[];
}

// El area determina que columnas de la tabla unificada se exponen y buscan.
// id_categoria se obtiene de la sesion; nunca se confia en un tenant enviado
// por el cliente.
export const AREA_CONFIG: Record<AreaSlug, AreaConfig> = {
  hardware: {
    nombreCategoria: 'HARDWARE',
    detailFields: [
      'tipo_equipo',
      'marca',
      'modelo',
      'numero_serie',
      'departamento',
      'ubicacion_fisica',
      'fecha_adquisicion',
      'fecha_fin_garantia',
    ],
    searchableFields: [
      'tipo_equipo',
      'marca',
      'modelo',
      'numero_serie',
      'departamento',
      'ubicacion_fisica',
    ],
  },
  software: {
    nombreCategoria: 'SOFTWARE',
    detailFields: [
      'categoria_item',
      'version_aprobada',
      'fecha_ultima_actualizacion',
      'tipo_licencia',
      'costo_total_usd',
      'fecha_adquisicion',
      'fecha_expiracion',
    ],
    searchableFields: ['categoria_item', 'version_aprobada', 'tipo_licencia'],
  },
  redes: {
    nombreCategoria: 'REDES',
    detailFields: [
      'modelo',
      'departamento',
      'direccion_ip',
      'red_pertenencia',
      'marca',
      'protocolo_enrutamiento',
      'tipo_dispositivo',
    ],
    searchableFields: [
      'modelo',
      'departamento',
      'direccion_ip',
      'red_pertenencia',
      'marca',
      'protocolo_enrutamiento',
      'tipo_dispositivo',
    ],
  },
  seguridad: {
    nombreCategoria: 'SEGURIDAD',
    detailFields: [
      'categoria_item',
      'funcion_seguridad',
      'criticidad',
      'fecha_ultima_revision',
      'resultado_revision',
    ],
    searchableFields: [
      'categoria_item',
      'funcion_seguridad',
      'criticidad',
      'resultado_revision',
    ],
  },
  calidad: {
    nombreCategoria: 'CALIDAD',
    detailFields: [
      'categoria_item',
      'criticidad',
      'fecha_ultima_revision',
      'resultado_revision',
    ],
    searchableFields: ['categoria_item', 'criticidad', 'resultado_revision'],
  },
  cloud: {
    nombreCategoria: 'CLOUD',
    detailFields: [
      'proveedor',
      'tipo_servicio',
      'identificador_recurso',
      'cuenta_proyecto',
      'region',
      'entorno',
      'costo_mensual_usd',
    ],
    searchableFields: [
      'proveedor',
      'tipo_servicio',
      'identificador_recurso',
      'cuenta_proyecto',
      'region',
      'entorno',
    ],
  },
  bigdata: {
    nombreCategoria: 'BIG DATA ANALITICAS',
    detailFields: [
      'tipo_activo',
      'fuente_origen',
      'clasificacion_sensibilidad',
      'ubicacion_repositorio',
    ],
    searchableFields: [
      'tipo_activo',
      'fuente_origen',
      'clasificacion_sensibilidad',
      'ubicacion_repositorio',
    ],
  },
};
