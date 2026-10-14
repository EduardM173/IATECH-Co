import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import type { Response as TestResponse } from 'supertest';
import type { Server } from 'node:http';
import ExcelJS from 'exceljs';
import contractSource from '../../database/contracts/inventarios-v2.json';
type ContractTuple = [
  name: string,
  type: string,
  nullable: boolean,
  length?: number | null,
  values?: string[] | null,
  defaultValue?: string | null,
];
interface Contract {
  table: string;
  id: string;
  fields: ContractTuple[];
}
const contract = contractSource as unknown as Record<string, Contract>;
interface JsonBody {
  token: string;
  message: string;
  fields: { name: string }[];
  data: Record<string, unknown>[];
  [name: string]: unknown;
}
function readBody(response: TestResponse): JsonBody {
  const raw: unknown = response.body;
  return raw as JsonBody;
}
import { AppModule } from '../src/app.module';
import { prisma, Prisma } from 'database';
import { originAllowed } from '../src/auth/tenant';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(
  url.hostname,
  '127.0.0.1',
  'Las pruebas necesitan PostgreSQL LOCAL',
);
assert.match(
  url.pathname,
  /_test$/,
  'Usar una base independiente terminada en _test',
);
const types: Record<string, string> = {
  int: 'integer',
  varchar: 'character varying',
  date: 'date',
  timestamp: 'timestamp without time zone',
  decimal: 'numeric',
};
let checks = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  checks++;
}
async function main() {
  assert.equal(
    Object.values(contract).reduce((sum, area) => sum + area.fields.length, 0),
    51,
  );
  for (const [area, c] of Object.entries(contract)) {
    const cols = await prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT column_name,data_type,character_maximum_length,numeric_precision,numeric_scale,datetime_precision,is_nullable,column_default FROM information_schema.columns WHERE table_schema=${area} AND table_name=${c.table} ORDER BY ordinal_position`,
    );
    assert.equal(cols.length, area === 'seguridad' ? 11 : 10);
    assert.deepEqual(
      cols.map((col) => col.column_name),
      c.fields.map((f) => f[0]),
    );
    for (const [index, tuple] of c.fields.entries()) {
      const [name, type, nullable, length, values, def] = tuple as unknown as [
        string,
        string,
        boolean,
        number,
        string[] | null,
        string | null,
      ];
      const col = cols[index];
      assert.equal(col.data_type, types[type], area + '.' + name);
      assert.equal(col.is_nullable, nullable ? 'YES' : 'NO');
      if (type === 'varchar')
        assert.equal(col.character_maximum_length, length);
      if (type === 'decimal') {
        assert.equal(col.numeric_precision, 10);
        assert.equal(col.numeric_scale, 2);
      }
      if (type === 'timestamp') assert.equal(col.datetime_precision, 3);
      if (name === c.id)
        check(
          String(col.column_default).startsWith('nextval('),
          'PK autoincremental',
        );
      else if (def === 'now')
        assert.equal(col.column_default, 'CURRENT_TIMESTAMP');
      else if (def === 'Activa')
        assert.match(
          String(col.column_default),
          /^'Activa'::character varying$/,
        );
      else if (def === '0.00') assert.equal(Number(col.column_default), 0);
      else assert.equal(col.column_default, null);
      if (values) {
        const constraints = await prisma.$queryRaw<{ definition: string }[]>(
          Prisma.sql`SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conname=${area + '_' + name + '_dominio'} AND connamespace=(SELECT oid FROM pg_namespace WHERE nspname=${area})`,
        );
        assert.equal(constraints.length, 1);
        const actual = [
          ...constraints[0].definition.matchAll(
            /'([^']*)'::character varying/g,
          ),
        ].map((m) => m[1]);
        assert.deepEqual(actual, values, 'Dominio exacto ' + area + '.' + name);
      }
      checks++;
    }
    const pk = await prisma.$queryRaw<{ name: string }[]>(
      Prisma.sql`SELECT a.attname AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=(SELECT oid FROM pg_class WHERE relname=${c.table} AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname=${area})) AND i.indisprimary`,
    );
    assert.deepEqual(
      pk.map((col) => col.name),
      [c.id],
    );
  }
  console.log(
    'Contrato PostgreSQL: 51 columnas verificadas, incluidos orden, dominios, precisión, PK, NULL y defaults',
  );
  process.env.AUTH_SECRET =
    'phase-two-integration-secret-at-least-32-characters';
  process.env.TENANT_ROOT_DOMAINS = 'localhost';
  process.env.API_HOSTNAMES = '127.0.0.1,localhost';
  process.env.TENANT_REQUIRE_SUBDOMAIN = 'true';
  process.env.DB_SCHEMA_ROLES = 'true';
  process.env.FEATURE_SECURITY_ACTIVITY = 'false';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (error: Error | null, allowed: boolean) => void,
    ) => cb(null, !origin || originAllowed(origin)),
    credentials: true,
  });
  await app.init();
  const httpServer: unknown = app.getHttpServer();
  const server = httpServer as Server;
  const categories: Record<string, string> = {
    seguridad: 'SEGURIDAD',
    software: 'SOFTWARE',
    bigdata: 'BIG DATA ANALITICAS',
    calidad: 'CALIDAD',
    redes: 'REDES',
  };
  const runId = randomBytes(5).toString('hex');
  const password = 'phase2-test-password-2026!';
  const sessions: Record<string, { token: string; cookie: string }> = {};
  const records: Record<string, Record<string, unknown>> = {
    seguridad: {
      nombre: '=' + runId,
      categoria_recurso: null,
      funcion_seguridad: 'Control de acceso',
      responsable: null,
      criticidad: 'Alta',
      estado_gestion: 'En uso',
      fecha_ultima_revision: null,
      resultado_revision: null,
    },
    software: {
      nombre_herramienta: 'Prueba ' + runId,
      categoria_dev: 'IDE',
      version_aprobada: '2026.10',
      tipo_licencia: 'Open Source',
      fecha_adquisicion: '2026-10-13',
      costo_total_usd: '1234.56',
      fecha_expiracion: null,
    },
    bigdata: {
      nombre_activo: 'Dataset ' + runId,
      tipo_activo: 'Dataset',
      fuente_origen: null,
      clasificacion_sensibilidad: 'Interna',
      responsable_owner: null,
      ubicacion_repositorio: null,
      estado: 'Activo',
      fecha_creacion: '2026-10-13',
      fecha_modificacion: null,
    },
    calidad: {
      nombre_herramienta: 'Prueba ' + runId,
      categoria_herramienta: 'Análisis de Código',
      responsable: null,
      criticidad: 'Media',
      estado_gestion: 'En revisión',
      fecha_ultima_revision: null,
      resultado_revision: null,
    },
    redes: {
      nombre_dispositivo: 'Prueba ' + runId,
      modelo: null,
      area_pertenencia: 'Sistemas',
      direccion_ip: '2001:db8::1',
      red_pertenencia: null,
      marca: null,
      protocolo_enrutamiento: 'No aplica',
      tipo_dispositivo: 'Switch',
      estado: 'Activo',
    },
  };
  const ids: Record<string, number> = {};
  try {
    for (const [area, category] of Object.entries(categories)) {
      const cat = await prisma.categoria.findUniqueOrThrow({
        where: { nombre_categoria: category },
      });
      const salt = randomBytes(16).toString('hex'),
        correo = runId + '.' + area + '@iatech.test';
      const user = await prisma.usuario.create({
        data: {
          nombre: 'Cuenta de prueba',
          correo,
          contrasena_hash:
            salt + ':' + scryptSync(password, salt, 32).toString('hex'),
          id_categoria: cat.id_categoria,
          rol: 'ADMIN',
        },
      });
      const response = await request(server)
        .post('/auth/login')
        .set('Origin', 'http://' + area + '.localhost:5173')
        .send({ correo, contrasena: password })
        .expect(200);
      const cookies = response.headers['set-cookie'] as unknown as string[];
      check(
        cookies[0].includes('HttpOnly') && cookies[0].includes('SameSite=Lax'),
        'Cookie HttpOnly y SameSite',
      );
      sessions[area] = {
        token: readBody(response).token,
        cookie: cookies[0].split(';')[0],
      };
      const common = request(server)
        .get('/inventarios/' + area + '/metadatos')
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + readBody(response).token);
      const metadata = await common.expect(200);
      assert.deepEqual(
        readBody(metadata).fields.map((f: { name: string }) => f.name),
        contract[area].fields.map((f) => f[0]),
      );
      const created = await request(server)
        .post('/inventarios/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + readBody(response).token)
        .send(records[area])
        .expect(201);
      ids[area] = Number(readBody(created)[contract[area].id]);
      check(ids[area] > 0, 'ID generado');
      await request(server)
        .get('/auth/me')
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Cookie', sessions[area].cookie)
        .expect(200);
      await request(server)
        .post('/inventarios/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Cookie', sessions[area].cookie)
        .send(records[area])
        .expect(403);
      checks++;
      const invalid = await request(server)
        .post('/inventarios/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + sessions[area].token)
        .send({ ...records[area], tenant_id: 1 })
        .expect(400);
      check(
        String(readBody(invalid).message).includes('Columna no permitida'),
        'Rechaza columnas técnicas',
      );
      const field = contract[area].fields.find((f) => Array.isArray(f[4]))![0];
      await request(server)
        .post('/inventarios/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + sessions[area].token)
        .send({ ...records[area], [field]: 'NO_APROBADO' })
        .expect(400);
      checks++;
      await request(server)
        .post('/auth/login')
        .set('Origin', 'http://' + area + '.localhost:5173')
        .send({ correo, contrasena: 'incorrecta' })
        .expect(401);
      checks++;
      assert.equal(
        (
          await prisma.usuario.findUniqueOrThrow({
            where: { id_usuario: user.id_usuario },
          })
        ).contrasena_hash,
        user.contrasena_hash,
      );
    }
    for (const [area, session] of Object.entries(sessions)) {
      for (const other of Object.keys(sessions)) {
        if (other === area) continue;
        const auth = 'Bearer ' + session.token,
          origin = 'http://' + area + '.localhost:5173';
        await request(server)
          .get('/inventarios/' + other)
          .set('Origin', origin)
          .set('Authorization', auth)
          .expect(403);
        await request(server)
          .patch('/inventarios/' + other + '/' + ids[other])
          .set('Origin', origin)
          .set('Authorization', auth)
          .send({ nombre: 'intrusión' })
          .expect(403);
        await request(server)
          .post('/reportes/' + other)
          .set('Origin', origin)
          .set('Authorization', auth)
          .send({ groupBy: [] })
          .expect(403);
        await request(server)
          .get('/bi/' + other + '/exportar')
          .set('Origin', origin)
          .set('Authorization', auth)
          .expect(403);
        await request(server)
          .get('/inventarios/' + other)
          .set('Origin', 'http://' + other + '.localhost:5173')
          .set('Authorization', auth)
          .expect(403);
        checks += 5;
      }
      await request(server)
        .get('/inventarios/' + area)
        .set('Origin', 'http://' + area + '.localhost.attacker.test:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .expect(403);
      await request(server)
        .get('/inventarios/' + area)
        .set('Host', 'software.localhost:3000')
        .set('Origin', 'http://seguridad.localhost:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .expect(403);
      checks += 2;
      const cfg = contract[area];
      const column = cfg.fields.find((f) => Array.isArray(f[4]))![0];
      const report = await request(server)
        .post('/reportes/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .send({ groupBy: [column] })
        .expect(201);
      check(readBody(report).data.length > 0, 'Reporte agrupado funcional');
      const second = (cfg.fields.find(
        (f) => Array.isArray(f[4]) && f[0] !== column,
      ) ??
        cfg.fields.find(
          (f) =>
            f[1] === 'varchar' &&
            f[0] !== column &&
            !String(f[0]).startsWith('nombre'),
        ))![0];
      await request(server)
        .post('/reportes/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .send({ groupBy: [column, second] })
        .expect(201);
      checks++;
      await request(server)
        .post('/reportes/' + area)
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .send({ groupBy: ['nombre); DROP TABLE core.usuario;--'] })
        .expect(400);
      checks++;
      await request(server)
        .get('/inventarios/' + area + '?pageSize=1000')
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .expect(400);
      checks++;
      const bytes = await request(server)
        .get('/bi/' + area + '/exportar')
        .set('Origin', 'http://' + area + '.localhost:5173')
        .set('Authorization', 'Bearer ' + session.token)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes.body as Buffer);
      const sheet = workbook.getWorksheet('Datos')!;
      assert.deepEqual(
        (sheet.getRow(1).values as unknown[]).slice(1),
        cfg.fields.map((f) => f[0]),
      );
      const row = sheet
        .getRows(2, sheet.rowCount - 1)!
        .find((r) => r.getCell(1).value === ids[area])!;
      check(Boolean(row), 'XLSX contiene registro original');
      for (const [index, field] of cfg.fields.entries()) {
        if (records[area][field[0]] === null)
          assert.equal(row.getCell(index + 1).value, null);
      }
      if (area === 'seguridad')
        check(
          row.getCell(2).type === ExcelJS.ValueType.String,
          'Texto iniciado en = no es fórmula',
        );
      if (area === 'software') {
        assert.equal(row.getCell(8).value, 1234.56);
        assert.equal(row.getCell(8).numFmt, '0.00');
        assert.equal(row.getCell(9).type, ExcelJS.ValueType.Date);
      }
    }
    const sec = sessions.seguridad;
    await request(server)
      .post('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        correo: runId + '.seguridad@iatech.test',
        contrasena: password,
      })
      .expect(403);
    checks++;
    const soft = sessions.software;
    const softAuth = 'Bearer ' + soft.token;
    const softOrigin = 'http://software.localhost:5173';
    const filtered = await request(server)
      .get('/inventarios/software?q=' + runId + '&pageSize=1')
      .set('Origin', softOrigin)
      .set('Authorization', softAuth)
      .expect(200);
    assert.equal(readBody(filtered).data.length, 1);
    assert.equal(readBody(filtered).data[0].costo_total_usd, '1234.56');
    const detail = await request(server)
      .post('/reportes/software')
      .set('Origin', softOrigin)
      .set('Authorization', softAuth)
      .send({
        q: runId,
        columns: ['nombre_herramienta', 'costo_total_usd'],
        groupBy: [],
      })
      .expect(201);
    assert.deepEqual(Object.keys(readBody(detail).data[0]), [
      'nombre_herramienta',
      'costo_total_usd',
    ]);
    for (const metric of ['sum', 'avg', 'min', 'max']) {
      const result = await request(server)
        .post('/reportes/software')
        .set('Origin', softOrigin)
        .set('Authorization', softAuth)
        .send({
          q: runId,
          groupBy: ['categoria_dev'],
          metric,
          metricColumn: 'costo_total_usd',
        })
        .expect(201);
      assert.equal(Number(readBody(result).data[0].valor), 1234.56);
      checks++;
    }
    await request(server)
      .get(
        '/inventarios/software?filters=' +
          encodeURIComponent(
            JSON.stringify([
              {
                column: 'fecha_adquisicion',
                op: 'between',
                value: '2026-10-01',
                to: '2026-10-31',
              },
            ]),
          ),
      )
      .set('Origin', softOrigin)
      .set('Authorization', softAuth)
      .expect(200);
    checks++;
    await request(server)
      .post('/inventarios/software')
      .set('Origin', softOrigin)
      .set('Authorization', softAuth)
      .send({ ...records.software, fecha_adquisicion: '2026-02-30' })
      .expect(400);
    checks++;
    await request(server)
      .post('/inventarios/software')
      .set('Origin', softOrigin)
      .set('Authorization', softAuth)
      .send({ ...records.software, costo_total_usd: '1.234' })
      .expect(400);
    checks++;
    const nullableCost = await request(server)
      .post('/inventarios/software')
      .set('Origin', softOrigin)
      .set('Authorization', softAuth)
      .send({ ...records.software, costo_total_usd: null })
      .expect(201);
    assert.equal(readBody(nullableCost).costo_total_usd, null);
    checks++;
    const limitMarker = 'export-limit-' + runId;
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO seguridad.recursos_seguridad(nombre) SELECT ${limitMarker} || n::text FROM generate_series(1,10001) n`,
    );
    try {
      await request(server)
        .get('/bi/seguridad/exportar?q=' + limitMarker)
        .set('Origin', 'http://seguridad.localhost:5173')
        .set('Authorization', 'Bearer ' + sec.token)
        .expect(400);
      checks++;
    } finally {
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM seguridad.recursos_seguridad WHERE nombre LIKE ${limitMarker + '%'}`,
      );
    }
    const listed = await request(server)
      .get(
        '/inventarios/seguridad?filters=' +
          encodeURIComponent(
            JSON.stringify([{ column: 'fecha_ultima_revision', op: 'isNull' }]),
          ),
      )
      .set('Origin', 'http://seguridad.localhost:5173')
      .set('Authorization', 'Bearer ' + sec.token)
      .expect(200);
    check(
      readBody(listed).data.some((r) => r.id_activo === ids.seguridad),
      'Filtros NULL',
    );
    const before = await prisma.recursoSeguridad.findUniqueOrThrow({
      where: { id_activo: ids.seguridad },
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    await request(server)
      .patch('/inventarios/seguridad/' + ids.seguridad)
      .set('Origin', 'http://seguridad.localhost:5173')
      .set('Cookie', sec.cookie)
      .set('X-IATECH-CSRF', '1')
      .send({ criticidad: 'Crítica' })
      .expect(200);
    const after = await prisma.recursoSeguridad.findUniqueOrThrow({
      where: { id_activo: ids.seguridad },
    });
    assert.equal(
      before.fecha_creacion.toISOString(),
      after.fecha_creacion.toISOString(),
    );
    check(
      after.fecha_modificacion > before.fecha_modificacion,
      'Modificación automática en PostgreSQL',
    );
    await request(server)
      .get('/seguridad/actividad')
      .set('Origin', 'http://seguridad.localhost:5173')
      .set('Authorization', 'Bearer ' + sec.token)
      .expect(404);
    checks++;
    for (const area of Object.keys(contract)) {
      const other = Object.keys(contract).find((name) => name !== area)!;
      let blocked = false;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE "iatech_' + area + '"');
          await tx.$queryRawUnsafe(
            'SELECT * FROM "' +
              other +
              '"."' +
              contract[other].table +
              '" LIMIT 1',
          );
        });
      } catch {
        blocked = true;
      }
      check(blocked, 'Rol PostgreSQL ' + area + ' no puede leer otro esquema');
    }
    for (const area of ['hardware', 'cloud']) {
      const cat = await prisma.categoria.findUniqueOrThrow({
        where: { nombre_categoria: area.toUpperCase() },
      });
      check(Boolean(cat), 'Se conserva configuración pendiente ' + area);
    }
    console.log(
      'Integración real: ' +
        checks +
        ' comprobaciones pasaron (aislamiento entre cinco áreas, cookies/CSRF, reportes, XLSX, NULL y roles)',
    );
  } finally {
    // Los fixtures son propios de esta ejecución y la URL ya se validó como _test local.
    for (const [area, cfg] of Object.entries(contract)) {
      const name = cfg.fields.find((field) =>
        field[0].startsWith('nombre'),
      )![0];
      const marker = records[area][name];
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM ${Prisma.raw('"' + area + '"."' + cfg.table + '"')} WHERE ${Prisma.raw('"' + name + '"')} = ${marker}`,
      );
    }
    await prisma.eventoAcceso.deleteMany({
      where: { correo: { startsWith: runId + '.', endsWith: '@iatech.test' } },
    });
    await prisma.usuario.deleteMany({
      where: { correo: { startsWith: runId + '.', endsWith: '@iatech.test' } },
    });
    await app.close();
  }
}
void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
