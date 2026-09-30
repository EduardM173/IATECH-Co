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

## Actividad de seguridad

Los usuarios del área `SEGURIDAD` tienen la opción **Actividad de seguridad** junto al inventario, en `/dashboard/seguridad/actividad`. El backend también restringe `GET /seguridad/actividad` a esta área mediante una sesión válida.

La sección registra los inicios de sesión exitosos y los fallos de credenciales enviados con un formato válido. Muestra correo, IP de conexión, fecha y resultado, sin almacenar contraseñas ni tokens. Incluye búsqueda por correo/IP, filtros de resultado y período, paginación y actualización manual. El historial comienza al aplicar la migración `20260930_security_activity`.

Una alerta identifica correos con al menos cinco fallos durante los últimos quince minutos; es informativa y no bloquea cuentas. Los contadores de éxitos y fallos respetan búsqueda y período, mientras las alertas activas abarcan todas las áreas. La IP proviene de la conexión al backend; no se confía en cabeceras de proxy enviadas por el cliente. Si falla la escritura del registro, se informa en los logs del servidor y el inicio de sesión sigue funcionando.

Para demostrarlo, realizar cinco accesos con contraseña incorrecta para un mismo correo válido, iniciar sesión en Seguridad y abrir la sección. El botón **Actualizar** permite revisar los nuevos eventos.
