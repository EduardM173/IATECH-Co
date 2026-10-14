import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AREA_NAMES, normalizeArea } from '../inventarios/inventory.config';

export function rootDomains() {
  return (process.env.TENANT_ROOT_DOMAINS ?? 'localhost')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
function areaFromHost(host: string): string | null {
  for (const root of rootDomains()) {
    if (host.endsWith('.' + root)) {
      const candidate = normalizeArea(host.slice(0, -(root.length + 1)));
      if (Object.hasOwn(AREA_NAMES, candidate)) return candidate;
    }
  }
  return null;
}
export function originAllowed(origin?: string) {
  if (!origin) return false;
  const exact = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  if (exact.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.origin === origin &&
      !url.username &&
      !url.password &&
      Boolean(areaFromHost(url.hostname)) &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          url.hostname.endsWith('.localhost') &&
          url.port === '5173'))
    );
  } catch {
    return false;
  }
}
export function requestTenant(request: Request): string | null {
  const host = request.hostname.toLowerCase();
  const apiHosts = (process.env.API_HOSTNAMES ?? 'localhost,127.0.0.1')
    .split(',')
    .map((s) => s.trim().toLowerCase());
  const hostArea = areaFromHost(host);
  if (!hostArea && !rootDomains().includes(host) && !apiHosts.includes(host))
    throw new ForbiddenException('Host no autorizado');
  const origin = request.headers.origin;
  if (origin && !originAllowed(origin))
    throw new ForbiddenException('Origen no autorizado');
  const originArea = origin ? areaFromHost(new URL(origin).hostname) : null;
  if (hostArea && originArea && hostArea !== originArea)
    throw new ForbiddenException(
      'El host y el origen pertenecen a áreas distintas',
    );
  return hostArea ?? originArea;
}
export function assertTenantIdentity(request: Request, category: string) {
  const tenant = requestTenant(request);
  const routeArea =
    typeof request.params.area === 'string'
      ? normalizeArea(request.params.area)
      : null;
  if (
    (tenant && AREA_NAMES[tenant] !== category) ||
    (routeArea && AREA_NAMES[routeArea] !== category)
  )
    throw new ForbiddenException('No tienes acceso a esta área');
  if (process.env.TENANT_REQUIRE_SUBDOMAIN === 'true' && !tenant)
    throw new ForbiddenException(
      'Abre el subdominio de tu área para continuar',
    );
}
