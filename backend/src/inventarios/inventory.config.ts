import { BadRequestException, NotFoundException } from '@nestjs/common';
import contract from '../../../database/contracts/inventarios-v2.json';

export type FieldType = 'int' | 'varchar' | 'date' | 'timestamp' | 'decimal';
export interface Field {
  name: string;
  type: FieldType;
  nullable: boolean;
  length?: number;
  values?: string[];
  defaultValue?: string;
  automatic: boolean;
}
export interface InventoryConfig {
  area: string;
  table: string;
  id: string;
  label: string;
  fields: Field[];
}
export const AREA_NAMES: Record<string, string> = {
  seguridad: 'SEGURIDAD',
  software: 'SOFTWARE',
  bigdata: 'BIG DATA ANALITICAS',
  calidad: 'CALIDAD',
  redes: 'REDES',
  hardware: 'HARDWARE',
  cloud: 'CLOUD',
};
export function normalizeArea(area: string) {
  return area === 'big-data' ? 'bigdata' : area;
}
export function inventoryConfig(rawArea: string): InventoryConfig {
  const area = normalizeArea(rawArea);
  if (!Object.hasOwn(contract, area))
    throw new NotFoundException(
      'Esta área está pendiente de recibir su diccionario de datos',
    );
  const source = contract[area as keyof typeof contract];
  return {
    area,
    table: source.table,
    id: source.id,
    label: source.label,
    fields: source.fields.map((tuple) => {
      const [name, type, nullable, length, values, defaultValue] =
        tuple as unknown as [
          string,
          FieldType,
          boolean,
          number | undefined,
          string[] | undefined,
          string | undefined,
        ];
      return {
        name,
        type,
        nullable,
        length: length ?? undefined,
        values: values ?? undefined,
        defaultValue: defaultValue ?? undefined,
        automatic: name === source.id || type === 'timestamp',
      };
    }),
  };
}
export function fieldConfig(config: InventoryConfig, name: unknown) {
  if (typeof name !== 'string')
    throw new BadRequestException('Selecciona una columna válida');
  const field = config.fields.find((item) => item.name === name);
  if (!field) throw new BadRequestException('Columna no permitida: ' + name);
  return field;
}
