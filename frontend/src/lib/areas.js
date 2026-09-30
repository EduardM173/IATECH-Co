// Mapea el nombre_categoria que devuelve el backend a la ruta del dashboard
// de esa área. Debe mantenerse alineado con AREAS en database/seed.ts.
export const AREA_ROUTES = {
  HARDWARE: '/dashboard/hardware',
  SOFTWARE: '/dashboard/software',
  REDES: '/dashboard/redes',
  SEGURIDAD: '/dashboard/seguridad',
  CALIDAD: '/dashboard/calidad',
  CLOUD: '/dashboard/cloud',
  'BIG DATA ANALITICAS': '/dashboard/big-data',
}

export function getAreaRoute(nombreCategoria) {
  return AREA_ROUTES[nombreCategoria?.toUpperCase()] ?? '/dashboard'
}
