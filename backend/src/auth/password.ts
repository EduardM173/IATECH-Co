import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function deriveKey(password: string, salt: string, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 32);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, encodedKey, extra] = storedHash.split(':');
  if (!salt || !encodedKey || extra || !/^[a-f0-9]{64}$/i.test(encodedKey)) {
    return false;
  }

  const expected = Buffer.from(encodedKey, 'hex');
  const actual = await deriveKey(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
