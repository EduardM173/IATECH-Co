import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { prisma, Prisma } from 'database';
import { AppModule } from '../src/app.module';
import { InventariosService } from '../src/inventarios/inventarios.service';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(
  url.hostname,
  '127.0.0.1',
  'Estas pruebas requieren PostgreSQL local',
);
assert.match(url.pathname, /_test$/, 'Usa una base independiente _test');

type Report = {
  mode: string;
  data: Record<string, unknown>[];
  rowTotals: Record<string, unknown>[];
  columnTotals: Record<string, unknown>[];
  grandTotal: Record<string, unknown>;
  meta: { total: number; totalRecords: number; totalPages: number };
};

async function main() {
  process.env.DB_SCHEMA_ROLES = 'true';
  process.env.FEATURE_SECURITY_ACTIVITY = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const service = app.get(InventariosService);
  const marker = 'REPORTE-' + randomBytes(6).toString('hex');
  const securityIds: number[] = [];
  const softwareIds: number[] = [];
  let checks = 0;
  try {
    const securityRows = [
      ['Crítica', 'En uso', '2026-01-12'],
      ['Crítica', 'En uso', '2026-01-18'],
      ['Crítica', 'En revisión', '2026-02-04'],
      ['Alta', 'En uso', '2026-02-09'],
      ['Media', 'Suspendido', null],
      ['Baja', 'Retirado', null],
      [null, 'En uso', null],
    ] as const;
    for (const [
      index,
      [criticidad, estado_gestion, fecha_ultima_revision],
    ] of securityRows.entries()) {
      const row = await service.save('seguridad', {
        nombre: `${marker}-${index}`,
        categoria_recurso: 'Prueba de reportes',
        funcion_seguridad: null,
        responsable: null,
        criticidad,
        estado_gestion,
        fecha_ultima_revision,
        resultado_revision: null,
      });
      securityIds.push(Number((row as Record<string, unknown>).id_activo));
    }
    const base = {
      q: marker,
      groupBy: ['criticidad'],
      metric: 'count',
      pageSize: 1,
    };
    const first = (await service.report('seguridad', {
      ...base,
      page: 1,
    })) as Report;
    const later = (await service.report('seguridad', {
      ...base,
      page: 4,
    })) as Report;
    assert.equal(first.mode, 'group');
    assert.equal(
      first.data.length,
      5,
      'Los grupos no dependen de la paginación',
    );
    assert.deepEqual(
      first.data,
      later.data,
      'Cambiar de página no altera agregados',
    );
    assert.deepEqual(
      first.data.map((row) => row.criticidad),
      ['Crítica', 'Alta', 'Media', 'Baja', null],
    );
    assert.deepEqual(
      first.data.map((row) => row.cantidad),
      [3, 1, 1, 1, 1],
    );
    assert.equal(first.grandTotal.cantidad, 7);
    checks += 6;

    const filtered = (await service.report('seguridad', {
      ...base,
      filters: [{ column: 'estado_gestion', op: 'eq', value: 'En uso' }],
    })) as Report;
    assert.equal(filtered.grandTotal.cantidad, 4);
    assert.deepEqual(
      filtered.data.map((row) => row.cantidad),
      [2, 1, 1],
    );
    checks += 2;

    const cross = (await service.report('seguridad', {
      q: marker,
      groupBy: ['criticidad', 'estado_gestion'],
      metric: 'count',
      pageSize: 1,
    })) as Report;
    assert.equal(cross.mode, 'cross');
    assert.equal(cross.data.length, 6);
    assert.equal(
      cross.rowTotals.reduce((sum, row) => sum + Number(row.cantidad), 0),
      7,
    );
    assert.equal(
      cross.columnTotals.reduce((sum, row) => sum + Number(row.cantidad), 0),
      7,
    );
    assert.equal(cross.grandTotal.cantidad, 7);
    assert.equal(
      cross.data.some(
        (row) => row.criticidad === 'Alta' && row.estado_gestion === 'Retirado',
      ),
      false,
    );
    checks += 6;

    const cell = (await service.report('seguridad', {
      q: marker,
      groupBy: [],
      drilldown: [
        { field: 'criticidad', value: 'Crítica' },
        { field: 'estado_gestion', value: 'En uso' },
      ],
      page: 1,
      pageSize: 1,
    })) as Report;
    assert.equal(cell.mode, 'detail');
    assert.equal(cell.meta.total, 2);
    assert.equal(cell.meta.totalPages, 2);
    assert.equal(cell.data.length, 1);
    checks += 4;

    const monthly = (await service.report('seguridad', {
      q: marker,
      groupBy: ['fecha_ultima_revision'],
      period: 'month',
      metric: 'count',
    })) as Report;
    assert.deepEqual(
      monthly.data.map((row) => [row.fecha_ultima_revision, row.cantidad]),
      [
        ['2026-01-01', 2],
        ['2026-02-01', 2],
        [null, 3],
      ],
    );
    const january = (await service.report('seguridad', {
      q: marker,
      groupBy: [],
      period: 'month',
      drilldown: [{ field: 'fecha_ultima_revision', value: '2026-01-01' }],
    })) as Report;
    assert.equal(january.meta.total, 2);
    checks += 2;

    const softwareRows = [
      ['IDE', '10.00'],
      ['IDE', '20.00'],
      ['QA', '90.00'],
      ['QA', null],
    ] as const;
    for (const [
      index,
      [categoria_dev, costo_total_usd],
    ] of softwareRows.entries()) {
      const row = await service.save('software', {
        nombre_herramienta: `${marker}-${index}`,
        categoria_dev,
        estado_funcionamiento: 'Activa',
        version_aprobada: '1.0',
        tipo_licencia: 'Open Source',
        costo_total_usd,
        fecha_adquisicion: '2026-01-01',
      });
      softwareIds.push(
        Number((row as Record<string, unknown>).id_herramienta_dev),
      );
    }
    const average = (await service.report('software', {
      q: marker,
      groupBy: ['categoria_dev'],
      metric: 'avg',
      metricColumn: 'costo_total_usd',
    })) as Report;
    assert.equal(average.grandTotal.cantidad, 4);
    assert.equal(
      Number(average.grandTotal.valor),
      40,
      'Promedio global ponderado, no promedio de promedios',
    );
    assert.equal(
      Number(average.data.find((row) => row.categoria_dev === 'IDE')?.valor),
      15,
    );
    assert.equal(
      Number(average.data.find((row) => row.categoria_dev === 'QA')?.valor),
      90,
    );
    checks += 4;

    const count = (await service.report('software', {
      q: marker,
      groupBy: ['categoria_dev', 'estado_funcionamiento'],
      metric: 'sum',
      metricColumn: 'costo_total_usd',
    })) as Report;
    assert.equal(Number(count.grandTotal.valor), 120);
    assert.equal(count.grandTotal.cantidad, 4);
    checks += 2;

    await assert.rejects(() =>
      service.report('seguridad', {
        q: marker,
        groupBy: ['id_activo'],
        metric: 'count',
      }),
    );
    await assert.rejects(() =>
      service.report('seguridad', {
        q: marker,
        groupBy: [],
        drilldown: [{ field: 'id_activo', value: 1 }],
      }),
    );
    checks += 2;
    console.log(
      `Reportes: ${checks} comprobaciones pasaron (agregados completos, filtros, NULL, cruces, drilldown, fechas y promedios)`,
    );
  } finally {
    if (securityIds.length)
      await prisma.$executeRaw`DELETE FROM seguridad.recursos_seguridad WHERE id_activo IN (${Prisma.join(securityIds)})`;
    if (softwareIds.length)
      await prisma.$executeRaw`DELETE FROM software.herramientas_desarrollo WHERE id_herramienta_dev IN (${Prisma.join(softwareIds)})`;
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
