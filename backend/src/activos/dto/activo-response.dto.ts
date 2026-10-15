import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoriaDto {
  @ApiProperty({ description: 'Id del area', type: Number })
  id_categoria: number;

  @ApiProperty({ description: 'Nombre del area', example: 'HARDWARE' })
  nombre_categoria: string;
}

export class InventarioListItemDto {
  @ApiProperty({ description: 'Id del registro de inventario' })
  id_inventario: number;

  @ApiProperty({ description: 'Nombre del activo o herramienta' })
  nombre: string;

  @ApiPropertyOptional({ description: 'Responsable del activo' })
  responsable: string | null;

  @ApiProperty({ description: 'Estado permitido para el area' })
  estado: string;

  @ApiProperty({ description: 'Fecha de creacion' })
  fecha_creacion: Date;

  @ApiProperty({ description: 'Fecha de ultima modificacion' })
  fecha_modificacion: Date;

  @ApiProperty({ type: CategoriaDto })
  categoria: CategoriaDto;

  @ApiProperty({
    description: 'Campos propios del area; no contiene columnas de otras areas',
    type: 'object',
    additionalProperties: true,
  })
  detalle: Record<string, unknown>;
}

export class PaginatedInventarioMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedInventarioDto {
  @ApiProperty({ type: [InventarioListItemDto] })
  data: InventarioListItemDto[];

  @ApiProperty({ type: PaginatedInventarioMetaDto })
  meta: PaginatedInventarioMetaDto;
}
