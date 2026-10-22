import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { originAllowed, requestTenant } from './tenant';

describe('orígenes del login local', () => {
  const previous = {
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    TENANT_ROOT_DOMAINS: process.env.TENANT_ROOT_DOMAINS,
    API_HOSTNAMES: process.env.API_HOSTNAMES,
  };

  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://127.0.0.1:5173';
    process.env.TENANT_ROOT_DOMAINS = 'localhost';
    process.env.API_HOSTNAMES = 'localhost,127.0.0.1';
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function request(hostname: string, origin: string): Request {
    return { hostname, headers: { origin }, params: {} } as unknown as Request;
  }

  it('acepta el origen central localhost aunque el origen exacto configurado sea 127.0.0.1', () => {
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(requestTenant(request('localhost', 'http://localhost:5173'))).toBeNull();
  });

  it('acepta el subdominio del área y conserva su identidad', () => {
    expect(originAllowed('http://seguridad.localhost:5173')).toBe(true);
    expect(requestTenant(request('seguridad.localhost', 'http://seguridad.localhost:5173'))).toBe('seguridad');
  });

  it('rechaza mezclar el host de un área con el origen de otra', () => {
    expect(() => requestTenant(request('seguridad.localhost', 'http://software.localhost:5173')))
      .toThrow(ForbiddenException);
  });

  it.each([
    'http://localhost:5174',
    'http://localhost.ejemplo.com:5173',
    'http://otra.localhost:5173',
    'http://seguridad.localhost:5174',
  ])('rechaza el origen no autorizado %s', (origin) => {
    expect(originAllowed(origin)).toBe(false);
    expect(() => requestTenant(request('localhost', origin))).toThrow(ForbiddenException);
  });
});
