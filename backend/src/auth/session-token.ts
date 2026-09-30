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

export function signSession(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
    }),
  ).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function verifySession(token: string): number | null {
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
    const { sub, exp } = parsed as Record<string, unknown>;
    if (!Number.isSafeInteger(sub) || typeof sub !== 'number' || sub <= 0)
      return null;
    if (typeof exp !== 'number' || exp <= Date.now() / 1000) return null;
    return sub;
  } catch {
    return null;
  }
}
