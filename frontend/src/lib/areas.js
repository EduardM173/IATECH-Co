export const AREA_CONFIG = {
  HARDWARE: {
    route: "/dashboard/hardware",
    label: "Hardware",
    fields: {
      tipo_equipo: "Tipo de equipo",
      marca: "Marca",
      modelo: "Modelo",
      numero_serie: "Número de serie",
      departamento: "Departamento",
      ubicacion_fisica: "Ubicación",
      fecha_adquisicion: "Adquisición",
      fecha_fin_garantia: "Fin de garantía",
    },
  },
  SOFTWARE: {
    route: "/dashboard/software",
    label: "Herramientas de Desarrollo",
    fields: {
      categoria_item: "Categoría",
      version_aprobada: "Versión aprobada",
      fecha_ultima_actualizacion: "Última actualización",
      tipo_licencia: "Licencia",
      costo_total_usd: "Costo total USD",
      fecha_adquisicion: "Adquisición",
      fecha_expiracion: "Expiración",
    },
  },
  REDES: {
    route: "/dashboard/redes",
    label: "Dispositivos de Red",
    fields: {
      modelo: "Modelo",
      departamento: "Área de pertenencia",
      direccion_ip: "Dirección IP",
      red_pertenencia: "Red",
      marca: "Marca",
      protocolo_enrutamiento: "Protocolo",
      tipo_dispositivo: "Tipo",
    },
  },
  SEGURIDAD: {
    route: "/dashboard/seguridad",
    label: "Recursos de Seguridad",
    fields: {
      categoria_item: "Categoría",
      funcion_seguridad: "Función",
      criticidad: "Criticidad",
      fecha_ultima_revision: "Última revisión",
      resultado_revision: "Resultado",
    },
  },
  CALIDAD: {
    route: "/dashboard/calidad",
    label: "Herramientas de Calidad",
    fields: {
      categoria_item: "Categoría",
      criticidad: "Criticidad",
      fecha_ultima_revision: "Última revisión",
      resultado_revision: "Resultado",
    },
  },
  CLOUD: {
    route: "/dashboard/cloud",
    label: "Recursos Cloud",
    fields: {
      proveedor: "Proveedor",
      tipo_servicio: "Servicio",
      identificador_recurso: "Identificador",
      cuenta_proyecto: "Cuenta / proyecto",
      region: "Región",
      entorno: "Entorno",
      costo_mensual_usd: "Costo mensual USD",
    },
  },
  "BIG DATA ANALITICAS": {
    route: "/dashboard/big-data",
    label: "Activos de Datos",
    fields: {
      tipo_activo: "Tipo",
      fuente_origen: "Fuente",
      clasificacion_sensibilidad: "Sensibilidad",
      ubicacion_repositorio: "Repositorio",
    },
  },
};

export const AREA_ROUTES = Object.fromEntries(
  Object.entries(AREA_CONFIG).map(([name, config]) => [name, config.route]),
);

export function getAreaRoute(nombreCategoria) {
  return AREA_CONFIG[nombreCategoria?.toUpperCase()]?.route ?? "/dashboard";
}

export function getAreaViewByRoute(areaRoute) {
  const route = `/dashboard/${areaRoute}`;
  return Object.values(AREA_CONFIG).find((config) => config.route === route);
}

export function formatInventoryValue(field, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (field.startsWith("fecha_")) {
    return new Intl.DateTimeFormat("es-BO", { timeZone: "UTC" }).format(
      new Date(value),
    );
  }
  if (field.startsWith("costo_")) {
    return new Intl.NumberFormat("es-BO", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(Number(value));
  }
  return String(value);
}
