import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { Prisma } from 'database';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { fieldConfig, inventoryConfig } from './inventory.config';
import type { Field, InventoryConfig } from './inventory.config';

type Row = Record<string, unknown>;
type Tx = Prisma.TransactionClient;
interface Filter {
  column: string;
  op: string;
  value?: unknown;
  to?: unknown;
}
const MAX_EXPORT = 10000;
function fail(message: string): never {
  throw new BadRequestException(message);
}
const identifier = (name: string) => Prisma.raw('"' + name + '"'); // solo nombres de la configuración validada

function integer(value: unknown, fallback: number, max: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max)
    fail('Paginación inválida');
  return parsed;
}
function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail('Usa una fecha YYYY-MM-DD');
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    fail('Fecha inválida');
  return value;
}
function valueFor(field: Field, value: unknown) {
  if (value === null) {
    if (!field.nullable) fail(field.name + ' es obligatorio');
    return null;
  }
  if (field.type === 'date') return date(value);
  if (field.type === 'decimal') {
    if (typeof value !== 'string' && typeof value !== 'number')
      fail(field.name + ' requiere un número decimal');
    const text = String(value);
    if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(text))
      fail(field.name + ' requiere DECIMAL(10,2)');
    return text;
  }
  if (field.type === 'int') {
    if (
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < 1 ||
      Number(value) > 2147483647
    )
      fail('Identificador inválido');
    return Number(value);
  }
  if (field.type === 'timestamp') {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value) ||
      !Number.isFinite(new Date(value + 'Z').getTime())
    )
      fail('Fecha y hora inválidas');
    date(value.slice(0, 10));
    return value;
  }
  if (
    typeof value !== 'string' ||
    value.includes('\0') ||
    Array.from(value).length > (field.length ?? 0)
  )
    fail(field.name + ': texto demasiado largo o inválido');
  if (field.values && !field.values.includes(value))
    fail(field.name + ': valor no permitido');
  if (field.name === 'direccion_ip' && value !== '' && !isIP(value))
    fail('Dirección IPv4/IPv6 inválida');
  return value;
}
function binding(field: Field, value: unknown): Prisma.Sql {
  if (value === null) return Prisma.sql`NULL`;
  const v = valueFor(field, value);
  if (field.type === 'decimal') return Prisma.sql`${v}::numeric`;
  if (field.type === 'date') return Prisma.sql`${v}::date`;
  if (field.type === 'timestamp') return Prisma.sql`${v}::timestamp`;
  if (field.type === 'int') return Prisma.sql`${v}::integer`;
  return Prisma.sql`${v}::varchar`;
}
function serialize(rows: Row[], config: InventoryConfig): Row[] {
  return rows.map<Row>((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (typeof value === 'bigint') return [key, Number(value)];
        if (value instanceof Date)
          return [
            key,
            value
              .toISOString()
              .slice(0, fieldConfig(config, key).type === 'date' ? 10 : 23),
          ];
        if (Prisma.Decimal.isDecimal(value)) return [key, value.toString()];
        return [key, value];
      }),
    ),
  );
}
function queryFilters(value: unknown): Filter[] {
  if (value === undefined || value === '') return [];
  let filters: unknown = value;
  if (typeof value === 'string') {
    try {
      filters = JSON.parse(value);
    } catch {
      fail('Filtros inválidos');
    }
  }
  if (!Array.isArray(filters) || filters.length > 10)
    fail('Máximo diez filtros');
  return filters as Filter[];
}

@Injectable()
export class InventariosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private table(config: InventoryConfig) {
    return Prisma.raw('"' + config.area + '"."' + config.table + '"');
  }
  private async transaction<T>(
    config: InventoryConfig,
    callback: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.client.$transaction(
      async (tx) => {
        // SET LOCAL impide que el rol se filtre a la siguiente solicitud del pool.
        if (process.env.DB_SCHEMA_ROLES !== 'false')
          await tx.$executeRawUnsafe(
            'SET LOCAL ROLE "iatech_' + config.area + '"',
          );
        return callback(tx);
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000, maxWait: 10000 },
    );
  }
  private where(config: InventoryConfig, query: Row) {
    const clauses: Prisma.Sql[] = [];
    if (query.q !== undefined) {
      if (typeof query.q !== 'string' || query.q.length > 200)
        fail('Búsqueda inválida');
      if (query.q.trim()) {
        const term = '%' + query.q.trim().replace(/[\\%_]/g, '\\$&') + '%';
        clauses.push(
          Prisma.sql`(${Prisma.join(
            config.fields
              .filter((f) => f.type === 'varchar')
              .map(
                (field) =>
                  Prisma.sql`${identifier(field.name)} ILIKE ${term} ESCAPE '\\'`,
              ),
            ' OR ',
          )})`,
        );
      }
    }
    for (const filter of queryFilters(query.filters)) {
      if (!filter || typeof filter !== 'object') fail('Filtro inválido');
      const field = fieldConfig(config, filter.column);
      const column = identifier(field.name);
      if (filter.op === 'isNull' || filter.op === 'notNull') {
        clauses.push(
          Prisma.sql`${column} ${Prisma.raw(filter.op === 'isNull' ? 'IS NULL' : 'IS NOT NULL')}`,
        );
      } else if (filter.op === 'contains') {
        if (
          field.type !== 'varchar' ||
          typeof filter.value !== 'string' ||
          filter.value.length > 200
        )
          fail('Este filtro requiere una columna de texto');
        const term = '%' + filter.value.replace(/[\\%_]/g, '\\$&') + '%';
        clauses.push(Prisma.sql`${column} ILIKE ${term} ESCAPE '\\'`);
      } else if (filter.op === 'between') {
        if (!['date', 'timestamp', 'decimal', 'int'].includes(field.type))
          fail('Rango no permitido para esta columna');
        clauses.push(
          Prisma.sql`${column} BETWEEN ${binding(field, filter.value)} AND ${binding(field, filter.to)}`,
        );
      } else {
        const operators: Record<string, string> = {
          eq: '=',
          ne: '<>',
          gte: '>=',
          lte: '<=',
        };
        if (!Object.hasOwn(operators, filter.op)) fail('Operador no permitido');
        if (filter.value === null)
          fail('Para valores vacíos utiliza el filtro es NULL');
        if (['gte', 'lte'].includes(filter.op) && field.type === 'varchar')
          fail('Operador no compatible con texto');
        clauses.push(
          Prisma.sql`${column} ${Prisma.raw(operators[filter.op])} ${binding(field, filter.value)}`,
        );
      }
    }
    return clauses.length
      ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`
      : Prisma.empty;
  }
  private sort(config: InventoryConfig, query: Row) {
    const field = fieldConfig(config, query.sort ?? config.id);
    const direction = query.direction ?? 'desc';
    if (typeof direction !== 'string' || !['asc', 'desc'].includes(direction))
      fail('Orden inválido');
    const tie =
      field.name === config.id
        ? Prisma.empty
        : Prisma.sql`, ${identifier(config.id)} DESC`;
    return Prisma.sql`ORDER BY ${identifier(field.name)} ${Prisma.raw(direction.toUpperCase())} NULLS LAST${tie}`;
  }
  metadata(area: string) {
    if (['hardware', 'cloud'].includes(area))
      return {
        enabled: false,
        area,
        reason: 'Pendiente de recibir los atributos aprobados',
      };
    const config = inventoryConfig(area);
    return {
      enabled: true,
      ...config,
      maxExport: MAX_EXPORT,
      activityEnabled: process.env.FEATURE_SECURITY_ACTIVITY === 'true',
    };
  }
  async list(area: string, query: Row) {
    const config = inventoryConfig(area);
    const page = integer(query.page, 1, 1000000),
      pageSize = integer(query.pageSize, 20, 100);
    const where = this.where(config, query),
      sort = this.sort(config, query);
    return this.transaction(config, async (tx) => {
      const counts = await tx.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total FROM ${this.table(config)} ${where}`,
      );
      const rows = await tx.$queryRaw<Row[]>(
        Prisma.sql`SELECT * FROM ${this.table(config)} ${where} ${sort} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      );
      const total = Number(counts[0].total);
      return {
        data: serialize(rows, config),
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    });
  }
  async save(area: string, body: Row, id?: number) {
    const config = inventoryConfig(area);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      fail('Registro inválido');
    const entries = Object.entries(body);
    if (!entries.length) fail('El registro está vacío');
    for (const [key, value] of entries) {
      const field = fieldConfig(config, key);
      if (field.automatic) fail(key + ' se administra automáticamente');
      valueFor(field, value);
    }
    if (id === undefined)
      for (const field of config.fields) {
        if (
          !field.automatic &&
          !field.nullable &&
          field.defaultValue === undefined &&
          !Object.hasOwn(body, field.name)
        )
          fail(field.name + ' es obligatorio');
      }
    return this.transaction(config, async (tx) => {
      const columns = entries.map(([key]) => identifier(key));
      const values = entries.map(([key, value]) =>
        binding(fieldConfig(config, key), value),
      );
      const statement =
        id === undefined
          ? Prisma.sql`INSERT INTO ${this.table(config)} (${Prisma.join(columns)}) VALUES (${Prisma.join(values)}) RETURNING *`
          : Prisma.sql`UPDATE ${this.table(config)} SET ${Prisma.join(entries.map(([key, value]) => Prisma.sql`${identifier(key)} = ${binding(fieldConfig(config, key), value)}`))} WHERE ${identifier(config.id)} = ${id} RETURNING *`;
      const rows = await tx.$queryRaw<Row[]>(statement);
      if (!rows.length)
        throw new NotFoundException('Registro no encontrado en tu área');
      return serialize(rows, config)[0];
    });
  }
  async report(area: string, query: Row) {
    const config = inventoryConfig(area);
    const rawGroupBy = query.groupBy ?? [];
    const rawColumns = query.columns ?? config.fields.map((f) => f.name);
    if (
      !Array.isArray(rawGroupBy) ||
      rawGroupBy.length > 2 ||
      new Set(rawGroupBy).size !== rawGroupBy.length
    )
      fail('Selecciona hasta dos columnas diferentes para agrupar');
    if (
      !Array.isArray(rawColumns) ||
      !rawColumns.length ||
      rawColumns.length > config.fields.length ||
      new Set(rawColumns).size !== rawColumns.length
    )
      fail('Columnas seleccionadas inválidas');
    const columns = rawColumns.map(
      (name: unknown) => fieldConfig(config, name).name,
    );
    const groupBy = rawGroupBy.map(
      (name: unknown) => fieldConfig(config, name).name,
    );
    groupBy.forEach((name) => {
      const field = fieldConfig(config, name);
      if (field.name === config.id || field.name.startsWith('nombre'))
        fail('Usa un reporte detallado para nombres e identificadores');
    });
    if (!groupBy.length) {
      const result = await this.list(area, query);
      return {
        ...result,
        mode: 'detail',
        columns,
        data: result.data.map((row) =>
          Object.fromEntries(columns.map((name) => [name, row[name]])),
        ),
      };
    }
    const metric = query.metric ?? 'count';
    if (
      typeof metric !== 'string' ||
      !['count', 'sum', 'avg', 'min', 'max'].includes(metric)
    )
      fail('Métrica no permitida');
    const metricField =
      metric === 'count' ? null : fieldConfig(config, query.metricColumn);
    if (metricField && metricField.type !== 'decimal')
      fail('Esta métrica requiere una columna decimal');
    const aggregate =
      metric === 'count'
        ? Prisma.sql`COUNT(*)`
        : Prisma.sql`${Prisma.raw(metric.toUpperCase())}(${identifier(metricField!.name)})`;
    const where = this.where(config, query);
    const grouping = Prisma.join(groupBy.map((name) => identifier(name)));
    const page = integer(query.page, 1, 1000000),
      pageSize = integer(query.pageSize, 20, 100);
    return this.transaction(config, async (tx) => {
      const counts = await tx.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total FROM (SELECT ${grouping} FROM ${this.table(config)} ${where} GROUP BY ${grouping}) groups`,
      );
      const rows = await tx.$queryRaw<Row[]>(
        Prisma.sql`SELECT ${grouping}, ${aggregate} AS valor FROM ${this.table(config)} ${where} GROUP BY ${grouping} ORDER BY ${grouping} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      );
      const data = rows.map((row) => {
        const result: Row = {};
        for (const [key, value] of Object.entries(row))
          result[key] =
            typeof value === 'bigint'
              ? Number(value)
              : Prisma.Decimal.isDecimal(value)
                ? value.toString()
                : value instanceof Date
                  ? value
                      .toISOString()
                      .slice(
                        0,
                        fieldConfig(config, key).type === 'date' ? 10 : 23,
                      )
                  : value;
        return result;
      });
      const total = Number(counts[0].total);
      return {
        mode: groupBy.length === 2 ? 'cross' : 'group',
        columns: [...groupBy, 'valor'],
        groupBy,
        metric,
        metricColumn: metricField?.name,
        data,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        note: metricField
          ? 'costo_total_usd mezcla costo de adquisición y gasto anual según el diccionario; no se interpreta como gasto anual.'
          : undefined,
      };
    });
  }
  async export(area: string, query: Row) {
    const config = inventoryConfig(area),
      where = this.where(config, query);
    return this.transaction(config, async (tx) => {
      const [{ total }] = await tx.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total FROM ${this.table(config)} ${where}`,
      );
      if (total > BigInt(MAX_EXPORT))
        fail(
          'Máximo ' +
            MAX_EXPORT +
            ' registros por exportación. Aplica filtros.',
        );
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Datos');
      sheet.columns = config.fields.map((field) => ({
        header: field.name,
        key: field.name,
        width: 25,
      }));
      let lastId = 0;
      while (true) {
        const cursor =
          where === Prisma.empty
            ? Prisma.sql`WHERE ${identifier(config.id)} > ${lastId}`
            : Prisma.sql`${where} AND ${identifier(config.id)} > ${lastId}`;
        const rows = await tx.$queryRaw<Row[]>(
          Prisma.sql`SELECT * FROM ${this.table(config)} ${cursor} ORDER BY ${identifier(config.id)} LIMIT 500`,
        );
        for (const row of rows) {
          const exported = config.fields.map((field) => {
            const value = row[field.name];
            // ExcelJS escribe cadenas como texto; nunca se asigna un objeto formula.
            if (value === null || value === undefined) return null;
            if (field.type === 'decimal') {
              const decimal = Prisma.Decimal.isDecimal(value)
                ? value.toString()
                : typeof value === 'string' || typeof value === 'number'
                  ? String(value)
                  : fail('Valor decimal no compatible');
              return Number(decimal);
            }
            return value instanceof Date
              ? value
              : typeof value === 'string'
                ? value.split('\0').join('')
                : value;
          });
          sheet.addRow(exported);
        }
        if (rows.length < 500) break;
        lastId = Number(rows.at(-1)![config.id]);
      }
      config.fields.forEach((field, index) => {
        if (field.type === 'date')
          sheet.getColumn(index + 1).numFmt = 'yyyy-mm-dd';
        if (field.type === 'timestamp')
          sheet.getColumn(index + 1).numFmt = 'yyyy-mm-dd hh:mm:ss';
        if (field.type === 'decimal')
          sheet.getColumn(index + 1).numFmt = '0.00';
      });
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: config.fields.length },
      };
      const dictionary = workbook.addWorksheet('Diccionario');
      dictionary.addRow(['atributo', 'tipo', 'nullable', 'valores_permitidos']);
      config.fields.forEach((field) =>
        dictionary.addRow([
          field.name,
          field.type === 'varchar'
            ? 'VARCHAR(' + field.length + ')'
            : field.type === 'decimal'
              ? 'DECIMAL(10,2)'
              : field.type.toUpperCase(),
          field.nullable ? 'Sí' : 'No',
          field.values?.join(', ') ?? '',
        ]),
      );
      return Buffer.from(await workbook.xlsx.writeBuffer());
    });
  }
}
