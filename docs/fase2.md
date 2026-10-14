# Fase 2 de inventarios

## Estado del avance
Rama local: `feat/avance-inventarios-fase2`. No se fusionó, publicó ni desplegó.
Las migraciones se ejecutaron únicamente en PostgreSQL 16.8 de pruebas, aislado en 127.0.0.1:55434.
La aplicación pública de Render/Vercel todavía utiliza la versión anterior.

Se verificaron las 51 columnas contra PostgreSQL real: nombres, orden, tipos, longitudes, precisión, PK, autoincremento, NULL, defaults y dominios. La referencia independiente está en `database/contracts/inventarios-v2.json`, no se deriva del esquema Prisma.
Software se contrastó con el Excel original `diccionario_datos_herramientas.xlsx`, hoja “Diccionario de Datos”, A1:F11.

## Tablas por área
| Área | Esquema y tabla | Columnas | Estado |
| --- | --- | --- | --- |
| Seguridad | seguridad.recursos_seguridad | 11 | Inventario, edición, reportes y BI |
| Software | software.herramientas_desarrollo | 10 | Inventario, edición, reportes y BI |
| Big Data | bigdata.activos_datos | 10 | Inventario, edición, reportes y BI |
| Calidad | calidad.herramientas_calidad | 10 | Inventario, edición, reportes y BI |
| Redes | redes.dispositivos_red | 10 | Inventario, edición, reportes y BI |
| Hardware | Configuración y cuenta existentes | Pendiente | Sin nuevas operaciones de inventario |
| Cloud | Configuración y cuenta existentes | Pendiente | Sin nuevas operaciones de inventario |

El proyecto original registra siete áreas; el documento menciona una sexta pendiente. Se conservaron Hardware y Cloud como configuraciones pendientes hasta confirmar cuál corresponde. No se inventaron tablas ni atributos nuevos para esas áreas.

Las tablas antiguas de detalle en public permanecen por compatibilidad con el historial de migraciones, vacías después de la transición. La nueva interfaz usa exclusivamente las cinco tablas aprobadas. La API antigua de consulta se mantiene para compatibilidad, siempre restringida por identidad y área.

## Decisiones que necesitan distinguirse del contrato aprobado
- Fuera de Software, la obligatoriedad no fue especificada para la mayoría de campos. Se adoptó NULL de forma provisional, excepto PK y fechas automáticas. Esto no se presenta como una nueva regla del ingeniero.
- DATETIME se representa como TIMESTAMP(3) WITHOUT TIME ZONE. Se conserva fecha y hora sin convertir a TIMESTAMPTZ. La precisión de milisegundos es una decisión de representación, no una nueva columna.
- Seguridad y Calidad generan fechas al insertar. PostgreSQL actualiza fecha_modificacion mediante trigger; la API impide editar ambas fechas automáticas.
- Big Data conserva DATE para fecha_creacion y fecha_modificacion; pueden introducirse como fechas de calendario. No se asumió automatización porque no fue especificada.
- Software mantiene DECIMAL(10,2) nullable con default 0.00 y versión como texto. Categoría y licencia son textos abiertos; estado sí es un dominio cerrado.
- No se añadieron tenant_id, area_id ni usuario_id a ninguna tabla de inventario.
- Los registros antiguos eran de prueba y el usuario autorizó descartarlos. Las nuevas tablas empiezan vacías; el seed no inventa datos para completarlas.

## Migración y credenciales
`20261013_inventory_phase2/migration.sql`:
1. Crea core y los cinco esquemas de inventario.
2. Mueve categoria, usuario y evento_acceso a core conservando sus IDs, hashes y relaciones.
3. Elimina únicamente los registros antiguos de public.activo y sus detalles mediante las FK existentes.
4. Crea las cinco tablas, dominios y triggers.

El SQL incluye BEGIN/COMMIT. No usa DROP TABLE, TRUNCATE ni migrate reset.
La limpieza de inventario es irreversible sin respaldo y está autorizada por su naturaleza de prueba. Las cuentas y contraseñas no se reemplazan.
Antes de usarlo sobre otro entorno, revisar el SQL y realizar pg_dump de esa base. En esta fase no se aplicó a producción.

El seed ahora crea únicamente áreas y cuentas faltantes. Los upsert de cuentas no actualizan hashes existentes. SEED_ADMIN_PASSWORD se utiliza solo para cuentas nuevas.

## Autenticación y aislamiento
Se reutilizó el token HMAC y el esquema scrypt del login. Se agregó cookie HttpOnly, SameSite=Lax, host-only y Secure en producción. Los tokens anteriores siguen aceptándose como Bearer; /auth/me permite migrarlos a cookie sin cambiar credenciales.
Las escrituras autenticadas con cookie requieren Origin autorizado y el encabezado X-IATECH-CSRF.

El backend valida:
- Host real (no confía en X-Forwarded-Host).
- Origin, contra dominios explícitos o subdominios de área conocidos.
- Concordancia entre host, origen, categoría autenticada y área de la ruta.
- Rol ADMIN para crear o editar; usuarios del área pueden consultar, generar reportes y exportar.

TENANT_REQUIRE_SUBDOMAIN=true exige subdominio. false permite la transición por rutas en un dominio compartido, manteniendo siempre la autorización por identidad.
TENANT_ROOT_DOMAINS contiene únicamente dominios realmente controlados. API_HOSTNAMES define los hosts del API compartido.

`database/security/schema-roles.sql` prepara roles NOLOGIN por área con permisos sobre su esquema. Las consultas usan SET LOCAL ROLE dentro de una transacción Prisma. El pool se comparte y el rol termina con la transacción.
DB_SCHEMA_ROLES=true es el valor efectivo por defecto. Si faltan los roles, las consultas fallan en lugar de abrir acceso a otros esquemas. El aprovisionamiento de roles requiere un administrador de PostgreSQL y se realiza por separado de la migración.

## Interfaz y módulos
- Una pantalla reutilizable obtiene metadatos del backend y muestra los atributos originales.
- Búsqueda, hasta diez filtros combinados, rangos, NULL, orden y paginación de 10/20/50/100.
- Formularios de alta y edición para administradores, con campos automáticos protegidos.
- Tablas anchas con desplazamiento horizontal dentro de la tarjeta.
- Inventario, Reportes y BI en la navegación de cada área.
- Actividad de seguridad conserva su código. FEATURE_SECURITY_ACTIVITY y VITE_FEATURE_SECURITY_ACTIVITY son false. La ruta frontend redirige y el endpoint backend responde 404.
- Los metadatos y operaciones de Hardware/Cloud indican que están pendientes.

Reportes:
- Detalles con selección de columnas para IDs y nombres.
- Conteos agrupados por una columna o cruce de dos columnas de la misma tabla.
- Tabla cruzada, gráfico de barras para conteos y filtros.
- Suma, promedio, mínimo y máximo de costo_total_usd en Software.
- Se aclara que costo_total_usd puede contener adquisición o gasto anual; no se presenta como gasto anual homogéneo.
- Grupos y visualizaciones son de la página actual, indicada expresamente.
- Columnas y operadores se validan en una lista controlada. Los valores se parametrizan; no se acepta SQL del cliente.

BI:
- XLSX real desde NestJS con ExcelJS 4.4.0.
- Hoja Datos en el orden exacto de las columnas; hoja Diccionario independiente.
- Exporta registros originales con los filtros actuales, no los agregados del reporte.
- Celdas de texto se escriben como texto, incluidas cadenas que empiezan por =. No se construyen fórmulas con entradas del usuario.
- Fechas tipadas, NULL como celdas vacías y decimales con dos cifras. Los diez dígitos de DECIMAL(10,2) caben en la precisión numérica de Excel.
- Máximo 10.000 registros; lectura por lotes de 500 y snapshot transaccional.
- No se configuró una integración directa con Tableau.

## Cómo probar localmente
Usar una base PostgreSQL de desarrollo independiente, nunca la URL de producción.
1. `pnpm install --frozen-lockfile`.
2. Copiar los tres .env.example. Definir DATABASE_URL coherente en database y backend, AUTH_SECRET (mínimo 32), SEED_ADMIN_PASSWORD (mínimo 12).
3. `pnpm --filter database db:generate`.
4. Revisar `database/prisma/migrations/20261013_inventory_phase2/migration.sql` y hacer respaldo de la base elegida.
5. `pnpm --filter database db:deploy`.
6. `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/security/schema-roles.sql` (usar la ruta completa a psql si no está en PATH).
7. `pnpm --filter database db:seed`.
8. `pnpm --filter backend start:dev`.
9. `pnpm --filter frontend dev`.
10. Abrir http://seguridad.localhost:5173/login (o software, bigdata, calidad, redes). El selector del login permite cambiar de subdominio.

Vite usa /api como proxy hacia 127.0.0.1:3000, conservando el host. No se necesita modificar DNS para probar *.localhost en el navegador usado.
Entrar con las cuentas existentes. En una base nueva, la contraseña es la definida en SEED_ADMIN_PASSWORD.

En la revisión local se usó una instancia temporal aislada en el puerto 55434, no el servicio PostgreSQL que ya estaba instalado. Se generó un respaldo local .dump antes de la transición y se verificó su catálogo con pg_restore.

## Comprobaciones realizadas
- Contrato PostgreSQL: 51 columnas aprobadas verificadas.
- `pnpm --filter backend test:phase2`: 242 comprobaciones reales, incluidas matrices de aislamiento entre las cinco áreas, cookies/CSRF, reportes, agregaciones decimales, exportación, NULL, filtros, fechas, límite de 10.000 registros y roles.
- `pnpm --filter database test:migration`: limpia inventario descartable y conserva íntegra una cuenta anterior (ID, categoría y hash).
- Pruebas unitarias existentes: 10 pasaron.
- Pruebas e2e existentes: 5 pasaron.
- Build/typecheck backend, lint de los archivos backend del avance, build y lint frontend: pasaron.
- Navegador: login por seguridad.localhost, inventario, reporte cruzado, BI, descarga XLSX y restauración de sesión al recargar.
- La exportación descargada se abrió también mediante el lector de Excel usado en las pruebas, comprobando encabezados, fechas, decimales, NULL y texto sin fórmulas.
- .github/workflows/phase2.yml deja preparado el job con PostgreSQL para futuras PR. Todavía no se ejecutó en GitHub porque esta rama no se publicó; para bloquear merges deberá marcarse como comprobación obligatoria en las reglas del repositorio.

Los comandos de integración exigen un host local 127.0.0.1 y una base cuyo nombre termine en _test. Crean fixtures y retiran únicamente los registros propios de su ejecución al terminar. La prueba de migración conserva su base temporal para inspección.

## Despliegue futuro y límites
- No hay dominio propio confirmado. Los subdominios públicos y sus certificados/DNS deben configurarse posteriormente.
- Se preparó frontend/vercel.json con proxy /api hacia el backend actual y fallback SPA para las rutas. No se aplicó al despliegue público.
- Para producción, Node debe ejecutarse con NODE_ENV=production y las variables de dominios/hosts deben coincidir con el entorno real.
- El proxy del mismo sitio es necesario para la cookie host-only; apuntar VITE_API_URL directamente a otro dominio con SameSite=Lax no mantiene esta sesión de navegador.
- La función de roles depende de privilegios de administración del proveedor PostgreSQL; no se cambió ninguna configuración de Render.
- El arranque en frío del plan gratuito de Render no se elimina mediante esta refactorización.
- Los registros de nuevas tablas se registran con sus atributos aprobados; no se migran ni se conservan los antiguos inventarios de demostración.
- Nulabilidad no especificada y precisión temporal provisional deben confirmarse con el ingeniero antes de integrar.
- Falta identificar y recibir las columnas del área pendiente.

## Archivos del avance
Base de datos: schema.prisma, seed.ts, contracts/inventarios-v2.json, migración 20261013_inventory_phase2, security/schema-roles.sql, test/migration-phase2.mjs y scripts en package.json.
Backend: inventarios/{inventory.config,inventarios.service,inventarios.controller,inventarios.module}, auth/{tenant,session.guard,auth.service,auth.controller}, app.module, main, tsconfig, package.json, test/phase2.integration.ts y .env.example.
Frontend: App, AuthContext, api, AreaHeader, Login, InventoryWorkspace, InventoryFilters, InventoryEditor, vite.config, vercel.json y .env.example. El código anterior de AreaDashboard y SecurityActivity se conserva.
Además: pnpm-lock.yaml, README, este documento y workflow de integración.

## Referencias técnicas
- Prisma 7: https://docs.prisma.io/docs/orm/v7/prisma-schema/data-model/multi-schema
- PostgreSQL SET ROLE: https://www.postgresql.org/docs/current/sql-set-role.html
- PostgreSQL esquemas y privilegios: https://www.postgresql.org/docs/current/ddl-schemas.html
