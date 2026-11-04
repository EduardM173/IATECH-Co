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

export const AREA_HOSTS = {
  HARDWARE: 'hardware',
  SOFTWARE: 'software',
  REDES: 'redes',
  SEGURIDAD: 'seguridad',
  CALIDAD: 'calidad',
  CLOUD: 'cloud',
  'BIG DATA ANALITICAS': 'bigdata',
}

export function getAreaHost(nombreCategoria) {
  return AREA_HOSTS[nombreCategoria?.toUpperCase()] ?? null
}
