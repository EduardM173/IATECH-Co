# IATECH-Co

## Avance de fase 2 (rama local)

La rama `feat/avance-inventarios-fase2` implementa inventarios por esquema, Reportes y BI. Consulta [la guía de fase 2](docs/fase2.md) para migraciones, permisos, subdominios, pruebas y límites. Este avance todavía no está publicado.

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
4. Copiar `frontend/.env.example` a `frontend/.env`. `VITE_API_URL=/api` utiliza el proxy local y permite las cookies de sesión.
5. Ejecutar `pnpm --filter database db:generate`, `pnpm --filter database db:deploy` y `pnpm --filter database db:seed`.
6. Aprovisionar los roles con `database/security/schema-roles.sql` como administrador de PostgreSQL.
7. En terminales separadas, ejecutar `pnpm --filter backend start:dev` y `pnpm --filter frontend dev`. Abrir `http://localhost:5173/login`; el sistema redirige al subdominio del área autorizada.

### Variables para despliegue

Los archivos `.env.example` son plantillas seguras para el equipo: no contienen secretos ni deben reemplazarse con valores reales en Git. Render almacena `DATABASE_URL`, `AUTH_SECRET`, `SEED_ADMIN_PASSWORD` y `CORS_ORIGIN`; Vercel compila `VITE_API_URL=/api` para servir el API mediante su proxy. Para desarrollo local, se usan las direcciones `localhost` incluidas en los ejemplos.

El acceso central requiere la migración aditiva `20261014_central_login`. Cada host mantiene su propia cookie HttpOnly; el paso del login central al área utiliza un código aleatorio de un solo uso que vence en 60 segundos. El cierre de sesión revoca primero la sesión del área y luego la central. Las sesiones anteriores a esta migración siguen siendo aceptadas hasta su vencimiento normal de ocho horas.
Las sesiones nuevas vencen a las ocho horas; para renovarlas se vuelve a iniciar sesión en el acceso central. No se guarda un token de renovación en el navegador.

Para usar subdominios en producción, configurar un dominio real con host central y hosts de área que sirvan el mismo frontend. En Vercel, definir `VITE_CENTRAL_ORIGIN` con el origen HTTPS central, `VITE_TENANT_ROOT_DOMAIN` con el dominio raíz y `VITE_API_URL=/api` para que cada host use el proxy de Vercel. En Render, configurar `CORS_ORIGIN` con el origen central, `TENANT_ROOT_DOMAINS` con el dominio raíz, `API_HOSTNAMES` con los hostnames reales del backend y del host central si el proxy conserva su cabecera Host, y `TENANT_REQUIRE_SUBDOMAIN=true`. Si no existe un dominio con subdominios configurados, dejar `VITE_TENANT_ROOT_DOMAIN` vacío y poner `TENANT_REQUIRE_SUBDOMAIN=false` para usar el flujo de un solo host hasta tenerlo. No usar un dominio supuesto como valor de producción.

La tabla actual de usuarios asigna un único `id_categoria` a cada `correo`; el acceso a varias áreas requiere una asociación explícita en una fase posterior. El login central no fusiona cuentas ni infiere áreas por correo.
La unicidad de `correo` distingue mayúsculas y minúsculas. Antes de activar el flujo en una base existente, revisar variantes con `SELECT lower(correo), count(*) FROM core.usuario GROUP BY lower(correo) HAVING count(*) > 1;`. El login conserva la coincidencia exacta actual y no modifica cuentas automáticamente.

El seed crea las siete categorías y las cuentas administradoras que falten, sin reemplazar contraseñas. El inventario antiguo era de prueba y se descarta en la migración de fase 2; las nuevas tablas empiezan vacías. La migración se ha probado únicamente en una base aislada, no en producción. El registro de otros usuarios requiere la sesión de un administrador de esa área.

## Actividad de seguridad

En fase 2 esta opción está oculta por defecto. Su código y el registro de accesos se conservan. Para habilitarla deben activarse `FEATURE_SECURITY_ACTIVITY` en backend y `VITE_FEATURE_SECURITY_ACTIVITY` en frontend. Mientras esté desactivada, la ruta frontend redirige al inventario y el endpoint devuelve 404.

La sección registra los inicios de sesión exitosos y los fallos de credenciales enviados con un formato válido. Muestra correo, IP de conexión, fecha y resultado, sin almacenar contraseñas ni tokens. Incluye búsqueda por correo/IP, filtros de resultado y período, paginación y actualización manual. El historial comienza al aplicar la migración `20260930_security_activity`.

Una alerta identifica correos con al menos cinco fallos durante los últimos quince minutos; es informativa y no bloquea cuentas. Los contadores de éxitos y fallos respetan búsqueda y período, mientras las alertas activas abarcan todas las áreas. La IP proviene de la conexión al backend; no se confía en cabeceras de proxy enviadas por el cliente. Si falla la escritura del registro, se informa en los logs del servidor y el inicio de sesión sigue funcionando.

Para demostrarlo, realizar cinco accesos con contraseña incorrecta para un mismo correo válido, iniciar sesión en Seguridad y abrir la sección. El botón **Actualizar** permite revisar los nuevos eventos.
