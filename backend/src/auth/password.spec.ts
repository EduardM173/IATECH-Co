import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('mantiene el formato salt:hash y verifica la contrasena', async () => {
    const stored = await hashPassword('una-contrasena-segura');

    expect(stored).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/);
    await expect(verifyPassword('una-contrasena-segura', stored)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('incorrecta', stored)).resolves.toBe(false);
  });

  it('rechaza hashes corruptos sin intentar autenticar', async () => {
    await expect(verifyPassword('cualquiera', 'invalido')).resolves.toBe(false);
  });
});
