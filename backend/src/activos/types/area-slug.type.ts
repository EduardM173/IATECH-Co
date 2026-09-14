export const AREA_SLUGS = [
  'hardware',
  'software',
  'redes',
  'seguridad',
  'calidad',
  'cloud',
  'bigdata',
] as const;

export type AreaSlug = (typeof AREA_SLUGS)[number];
