import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 8;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET debe tener al menos 32 caracteres');
  }
  return secret;
}

function signature(payload: string): Buffer {
  return createHmac('sha256', getSecret()).update(payload).digest();
}

export function signSession(
  userId: number,
  sessionId?: string,
  scope?: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
      ...(sessionId ? { sid: sessionId, scope } : {}),
    }),
  ).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export interface SessionClaims {
  userId: number;
  sessionId: string | null;
  scope: string | null;
}

export function verifySessionClaims(token: string): SessionClaims | null {
  const [payload, signed, extra] = token.split('.');
  if (!payload || !signed || extra) return null;
  const actual = Buffer.from(signed, 'base64url');
  const expected = signature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (!parsed || typeof parsed !== 'object') return null;
    const { sub, exp, sid, scope } = parsed as Record<string, unknown>;
    if (!Number.isSafeInteger(sub) || typeof sub !== 'number' || sub <= 0)
      return null;
    if (typeof exp !== 'number' || exp <= Date.now() / 1000) return null;
    if (typeof sid !== 'undefined' || typeof scope !== 'undefined') {
      if (
        typeof sid !== 'string' ||
        !/^[a-f0-9]{64}$/.test(sid) ||
        typeof scope !== 'string' ||
        !/^(central|seguridad|software|bigdata|calidad|redes|hardware|cloud)$/.test(scope)
      ) return null;
      return { userId: sub, sessionId: sid, scope };
    }
    return { userId: sub, sessionId: null, scope: null };
  } catch {
    return null;
  }
}

export function verifySession(token: string): number | null {
  return verifySessionClaims(token)?.userId ?? null;
}
