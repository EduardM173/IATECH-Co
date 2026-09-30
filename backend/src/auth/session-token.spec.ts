import { signSession, verifySession } from './session-token';

describe('session token', () => {
  const previousSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET =
      'integration-test-secret-with-more-than-32-characters';
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
    jest.useRealTimers();
  });

  it('acepta una sesión firmada y rechaza una firma alterada', () => {
    const token = signSession(7);
    expect(verifySession(token)).toBe(7);
    expect(verifySession(`${token}x`)).toBeNull();
  });

  it('rechaza una sesión vencida', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T12:00:00Z'));
    const token = signSession(7);
    jest.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    expect(verifySession(token)).toBeNull();
  });
});
