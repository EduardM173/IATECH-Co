import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { Prisma } from 'database';
import ExcelJS from 'exceljs';
import { readInventoryWorkbook } from './excel-reader';
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
const MAX_IMPORT = 1000;
const MAX_REPORT_GROUPS = 5000;
export interface SpreadsheetFile {
  buffer: Buffer;
  originalname: string;
}

// Check declared ZIP sizes before ExcelJS inflates the workbook (no ZIP64).
function checkWorkbookSize(buffer: Buffer) {
  if (buffer.length < 22 || buffer.length > 5 * 1024 * 1024)
    fail('El Excel debe pesar como máximo 5 MB');
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0) fail('Archivo XLSX inválido');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16),
    total = 0;
  if (
    count > 2000 ||
    buffer.readUInt16LE(end + 4) !== 0 ||
    buffer.readUInt16LE(end + 6) !== 0
  )
    fail('El Excel es demasiado complejo o usa un formato no admitido');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      fail('Archivo XLSX inválido');
    total += buffer.readUInt32LE(offset + 24);
    if (total > 20 * 1024 * 1024)
      fail('El contenido descomprimido del Excel supera 20 MB');
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
  if (offset !== end) fail('Archivo XLSX inválido');
}
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
    fail(
      field.name +
        ': valor no permitido. Usa ' +
        field.values.join(', ') +
        (field.nullable ? ' o deja la celda vacía si no corresponde' : ''),
    );
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

  async importTemplate(area: string) {
    const config = inventoryConfig(area);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Datos');
    const fields = config.fields.filter((field) => !field.automatic);
    sheet.columns = fields.map((field) => ({
      header: field.name,
      key: field.name,
      width: 28,
      style: {
        numFmt:
          field.type === 'varchar'
            ? '@'
            : field.type === 'date'
              ? 'yyyy-mm-dd'
              : '0.00',
      },
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const dictionary = workbook.addWorksheet('Instrucciones');
    dictionary.addRow([
      'Columna',
      'Tipo',
      'Obligatoria',
      'Valores permitidos / formato',
      'Predeterminado si no se incluye la columna',
    ]);
    for (const field of fields)
      dictionary.addRow([
        field.name,
        field.type,
        !field.nullable && field.defaultValue === undefined ? 'Sí' : 'No',
        field.values?.join(', ') ??
          (field.type === 'date'
            ? 'YYYY-MM-DD o fecha Excel'
            : field.length
              ? 'Máximo ' + field.length + ' caracteres'
              : 'DECIMAL(10,2)'),
        field.defaultValue ?? 'NULL',
      ]);
    dictionary.columns.forEach((column) => {
      column.width = 32;
    });
    dictionary.getRow(1).font = { bold: true };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async parseImport(area: string, file?: SpreadsheetFile) {
    const config = inventoryConfig(area);
    if (!file || !/\.xlsx$/i.test(file.originalname))
      fail('Selecciona un archivo .xlsx');
    checkWorkbookSize(file.buffer);
    let workbook: ExcelJS.Workbook;
    try {
      workbook = await readInventoryWorkbook(file.buffer);
    } catch {
      fail(
        'No se pudo interpretar la estructura del Excel. El archivo puede estar dañado, cifrado o usar un formato no compatible. Prueba guardarlo nuevamente como .xlsx',
      );
    }
    const sheet = workbook.getWorksheet('Datos') ?? workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) fail('El Excel no contiene registros');
    if (
      sheet.rowCount > MAX_IMPORT + 1 ||
      sheet.columnCount > config.fields.length
    )
      fail('Máximo 1000 filas de datos y únicamente las columnas del área');
    const headers: Field[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      const header = sheet.getRow(1).getCell(c).value;
      if (typeof header !== 'string')
        fail('La primera fila debe contener los nombres de las columnas');
      const field = fieldConfig(config, header.trim());
      if (headers.some((f) => f.name === field.name))
        fail('Columna repetida: ' + field.name);
      headers.push(field);
    }
    const editable = config.fields.filter((f) => !f.automatic);
    for (const field of editable) {
      if (
        !field.nullable &&
        field.defaultValue === undefined &&
        !headers.some((f) => f.name === field.name)
      )
        fail('Falta la columna obligatoria: ' + field.name);
    }
    if (!headers.some((f) => !f.automatic))
      fail('Incluye al menos una columna editable');
    const rows: Row[] = [],
      errors: { row: number; column: string; message: string }[] = [];
    let errorCount = 0;
    for (let r = 2; r <= sheet.rowCount; r++) {
      const excelRow = sheet.getRow(r);
      if (!excelRow.hasValues) continue;
      const row: Row = {};
      headers.forEach((field, i) => {
        if (field.automatic) return;
        try {
          let value: unknown = excelRow.getCell(i + 1).value;
          if (value === '' || value === undefined) value = null;
          if (value instanceof Date && field.type === 'date')
            value = value.toISOString().slice(0, 10);
          if (value !== null && typeof value === 'object')
            fail('No se admiten fórmulas, enlaces ni celdas especiales');
          row[field.name] = valueFor(field, value);
        } catch (error) {
          errorCount++;
          if (errors.length < 100)
            errors.push({
              row: r,
              column: field.name,
              message: error instanceof Error ? error.message : 'Dato inválido',
            });
        }
      });
      rows.push(row);
    }
    if (!rows.length) fail('El Excel no contiene registros');
    return {
      config,
      rows,
      errors,
      errorCount,
      sheet: sheet.name,
      ignoredColumns: headers.filter((f) => f.automatic).map((f) => f.name),
    };
  }

  async previewImport(area: string, file?: SpreadsheetFile) {
    const parsed = await this.parseImport(area, file);
    return {
      sheet: parsed.sheet,
      total: parsed.rows.length,
      columns: parsed.config.fields
        .filter((f) => !f.automatic)
        .map((f) => f.name),
      data: parsed.rows.slice(0, 20),
      ignoredColumns: parsed.ignoredColumns,
      errors: parsed.errors,
      errorCount: parsed.errorCount,
      canImport: parsed.errorCount === 0,
    };
  }

  async importExcel(area: string, file?: SpreadsheetFile) {
    const { config, rows, errorCount } = await this.parseImport(area, file);
    if (errorCount)
      fail(
        'Corrige los errores del Excel antes de importarlo. No se guardó ningún registro',
      );
    const fields = config.fields.filter((f) => !f.automatic);
    await this.transaction(config, async (tx) => {
      for (let start = 0; start < rows.length; start += 100) {
        const values = rows
          .slice(start, start + 100)
          .map(
            (row) =>
              Prisma.sql`(${Prisma.join(fields.map((field) => (Object.hasOwn(row, field.name) ? binding(field, row[field.name]) : Prisma.raw('DEFAULT'))))})`,
          );
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO ${this.table(config)} (${Prisma.join(fields.map((f) => identifier(f.name)))}) VALUES ${Prisma.join(values)}`,
        );
      }
    });
    return { imported: rows.length };
  }

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
  private sort(config: InventoryConfig, query: Row, inventoryOrder = false) {
    const field = fieldConfig(config, query.sort ?? config.id);
    const direction = query.direction ?? 'desc';
    if (typeof direction !== 'string' || !['asc', 'desc'].includes(direction))
      fail('Orden inválido');
    const order =
      inventoryOrder && field.values
        ? Prisma.sql`CASE WHEN ${identifier(field.name)} IS NULL THEN NULL ELSE CASE ${identifier(field.name)} ${Prisma.join(
            field.values.map(
              (value, index) => Prisma.sql`WHEN ${value} THEN ${index}`,
            ),
            ' ',
          )} ELSE ${field.values.length} END END`
        : inventoryOrder && field.type === 'varchar'
          ? Prisma.sql`LOWER(${identifier(field.name)})`
          : identifier(field.name);
    const tie =
      field.name === config.id
        ? Prisma.empty
        : Prisma.sql`, ${identifier(config.id)} DESC`;
    return Prisma.sql`ORDER BY ${order} ${Prisma.raw(direction.toUpperCase())} NULLS LAST${tie}`;
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
      sort = this.sort(config, query, true);
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
      if (
        field.name === config.id ||
        field.name.startsWith('nombre') ||
        !['varchar', 'date', 'timestamp'].includes(field.type)
      )
        fail('Usa un reporte detallado para nombres e identificadores');
    });
    const period = query.period ?? 'month';
    if (
      typeof period !== 'string' ||
      !['day', 'month', 'year'].includes(period)
    )
      fail('Período no permitido');
    const periodGroup = (name: string) => {
      const field = fieldConfig(config, name);
      return field.type === 'date' || field.type === 'timestamp'
        ? Prisma.sql`DATE_TRUNC(${Prisma.raw("'" + period + "'")}, ${identifier(name)})::date`
        : Prisma.sql`${identifier(name)}`;
    };
    if (!groupBy.length) {
      const rawDrilldown = query.drilldown ?? [];
      if (!Array.isArray(rawDrilldown) || rawDrilldown.length > 2)
        fail('Detalle de reporte inválido');
      const clauses: Prisma.Sql[] = [];
      const seen = new Set<string>();
      for (const item of rawDrilldown as unknown[]) {
        if (!item || typeof item !== 'object' || Array.isArray(item))
          fail('Detalle de reporte inválido');
        const entry = item as Row;
        const field = fieldConfig(config, entry.field);
        if (
          seen.has(field.name) ||
          field.name === config.id ||
          field.name.startsWith('nombre') ||
          !['varchar', 'date', 'timestamp'].includes(field.type)
        )
          fail('Columna de detalle inválida');
        seen.add(field.name);
        if (entry.value === null) {
          if (!field.nullable) fail('Este campo no admite NULL');
          clauses.push(Prisma.sql`${identifier(field.name)} IS NULL`);
        } else if (field.type === 'date' || field.type === 'timestamp') {
          const value = date(entry.value);
          const start = new Date(value + 'T00:00:00Z');
          if (
            (period === 'month' && start.getUTCDate() !== 1) ||
            (period === 'year' &&
              (start.getUTCDate() !== 1 || start.getUTCMonth() !== 0))
          )
            fail('Inicio de período inválido');
          clauses.push(Prisma.sql`${periodGroup(field.name)} = ${value}::date`);
        } else {
          const value = valueFor(field, entry.value);
          clauses.push(
            Prisma.sql`${identifier(field.name)} = ${value}::varchar`,
          );
        }
      }
      const baseWhere = this.where(config, query);
      const where = clauses.length
        ? baseWhere === Prisma.empty
          ? Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`
          : Prisma.sql`${baseWhere} AND ${Prisma.join(clauses, ' AND ')}`
        : baseWhere;
      const page = integer(query.page, 1, 1000000);
      const pageSize = integer(query.pageSize, 20, 100);
      const sort = this.sort(config, query);
      return this.transaction(config, async (tx) => {
        const [{ total }] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM ${this.table(config)} ${where}`,
        );
        const rows = await tx.$queryRaw<Row[]>(
          Prisma.sql`SELECT * FROM ${this.table(config)} ${where} ${sort} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        );
        return {
          mode: 'detail',
          columns,
          data: serialize(rows, config).map((row) =>
            Object.fromEntries(columns.map((name) => [name, row[name]])),
          ),
          meta: {
            page,
            pageSize,
            total: Number(total),
            totalPages: Math.ceil(Number(total) / pageSize),
          },
        };
      });
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
    const expressions = groupBy.map(periodGroup);
    const selected = expressions.map(
      (expression, index) =>
        Prisma.sql`${expression} AS ${identifier('group' + index)}`,
    );
    const flags = expressions.map(
      (expression, index) =>
        Prisma.sql`GROUPING(${expression}) AS ${identifier('roll' + index)}`,
    );
    const sets =
      groupBy.length === 1
        ? Prisma.sql`((${expressions[0]}), ())`
        : Prisma.sql`((${expressions[0]}, ${expressions[1]}), (${expressions[0]}), (${expressions[1]}), ())`;
    type AggregateRow = {
      group0: unknown;
      group1?: unknown;
      roll0: number;
      roll1?: number;
      valor: unknown;
      cantidad: bigint;
    };
    const format = (value: unknown) =>
      typeof value === 'bigint'
        ? Number(value)
        : Prisma.Decimal.isDecimal(value)
          ? value.toString()
          : value instanceof Date
            ? value.toISOString().slice(0, 10)
            : value;
    const categoryOrder = (name: string, left: Row, right: Row) => {
      const a = left[name],
        b = right[name];
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
      const field = fieldConfig(config, name);
      // Los grupos permitidos son texto o fechas serializadas como texto.
      const leftText = a as string;
      const rightText = b as string;
      if (field.values)
        return field.values.indexOf(leftText) - field.values.indexOf(rightText);
      if (field.type === 'date' || field.type === 'timestamp')
        return leftText.localeCompare(rightText);
      return (
        Number(right.cantidad) - Number(left.cantidad) ||
        leftText.localeCompare(rightText, 'es')
      );
    };
    return this.transaction(config, async (tx) => {
      const rows = await tx.$queryRaw<AggregateRow[]>(
        Prisma.sql`SELECT ${Prisma.join([...selected, ...flags, Prisma.sql`${aggregate} AS valor`, Prisma.sql`COUNT(*) AS cantidad`])} FROM ${this.table(config)} ${where} GROUP BY GROUPING SETS ${sets} LIMIT ${MAX_REPORT_GROUPS * 3 + 2}`,
      );
      const item = (row: AggregateRow): Row => ({
        ...Object.fromEntries(
          groupBy.map((name, index) => [
            name,
            format(index === 0 ? row.group0 : row.group1),
          ]),
        ),
        valor: format(row.valor),
        cantidad: Number(row.cantidad),
      });
      const data = rows
        .filter(
          (row) => row.roll0 === 0 && (groupBy.length === 1 || row.roll1 === 0),
        )
        .map(item);
      if (
        rows.length >= MAX_REPORT_GROUPS * 3 + 2 ||
        data.length > MAX_REPORT_GROUPS
      )
        fail(
          'Demasiadas combinaciones para analizar. Aplica filtros y vuelve a consultar.',
        );
      data.sort(
        (a, b) =>
          categoryOrder(groupBy[0], a, b) ||
          (groupBy[1] ? categoryOrder(groupBy[1], a, b) : 0),
      );
      const rowTotals =
        groupBy.length === 2
          ? rows.filter((row) => row.roll0 === 0 && row.roll1 === 1).map(item)
          : [];
      const columnTotals =
        groupBy.length === 2
          ? rows.filter((row) => row.roll0 === 1 && row.roll1 === 0).map(item)
          : [];
      if (groupBy.length === 2) {
        rowTotals.sort((a, b) => categoryOrder(groupBy[0], a, b));
        columnTotals.sort((a, b) => categoryOrder(groupBy[1], a, b));
      }
      const grandTotal = item(
        rows.find(
          (row) => row.roll0 === 1 && (groupBy.length === 1 || row.roll1 === 1),
        )!,
      );
      return {
        mode: groupBy.length === 2 ? 'cross' : 'group',
        columns: [...groupBy, 'valor', 'cantidad'],
        groupBy,
        period,
        metric,
        metricColumn: metricField?.name,
        data,
        rowTotals,
        columnTotals,
        grandTotal,
        meta: {
          page: 1,
          pageSize: data.length,
          total: data.length,
          totalRecords: grandTotal.cantidad,
          totalPages: data.length ? 1 : 0,
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
