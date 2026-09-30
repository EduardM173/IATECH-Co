# IATECH-Co

## Versiones de tecnologías

Versiones registradas para mantener la consistencia del proyecto:

| Tecnología | Versión | Ubicación |
| --- | --- | --- |
| Node.js | 22.14.0 | Entorno de desarrollo |
| pnpm | 11.25.0 | Gestor de paquetes usado para integrar el workspace |
| React | 19.3.0 | `frontend` |
| React DOM | 19.3.0 | `frontend` |
| Vite | 8.3.1 | `frontend` |
| NestJS | 11.2.6 | `backend` |
| Express | 5.2.1 | Adaptador predeterminado de NestJS en `backend` |
| Prisma ORM | 7.10.0 | `database` |
| Prisma Client | 7.10.0 | `database` |

Las versiones instaladas del workspace integrado están fijadas en el `pnpm-lock.yaml` de la raíz.

## Arranque local

Se necesita una instancia de PostgreSQL. Desde la raíz del repositorio:

1. Ejecutar `pnpm install`.
2. Copiar `database/.env.example` a `database/.env` y definir `DATABASE_URL` y una contraseña propia en `SEED_ADMIN_PASSWORD` (mínimo 12 caracteres).
3. Copiar `backend/.env.example` a `backend/.env` y definir el mismo `DATABASE_URL` y un `AUTH_SECRET` aleatorio (mínimo 32 caracteres). Ajustar `CORS_ORIGIN` si el frontend usa otra dirección.
4. Ejecutar `pnpm --filter database db:generate`, `pnpm --filter database db:deploy` y `pnpm --filter database db:seed`.
5. En terminales separadas, ejecutar `pnpm --filter backend start:dev` y `pnpm --filter frontend dev`.

El seed crea las siete categorías y un administrador por área. Los activos se consultan desde la API con una sesión válida; cada usuario solo puede ver los de su área. El registro de otros usuarios requiere la sesión de un administrador de esa área.
