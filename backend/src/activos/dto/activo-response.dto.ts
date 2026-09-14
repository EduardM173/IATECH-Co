import { ApiProperty } from '@nestjs/swagger';

export class CategoriaDto {
  @ApiProperty({ description: 'Id de la categoria (area)', type: Number })
  id_categoria: number;

  @ApiProperty({ description: 'Nombre de la categoria (area)', type: String, example: 'HARDWARE' })
  nombre_categoria: string;
}

export class ActivoListItemDto {
  @ApiProperty({ description: 'Id del activo', type: Number })
  id_activo: number;

  @ApiProperty({ description: 'Codigo unico del activo', type: String, example: 'HW-0012' })
  codigo: string;

  @ApiProperty({ description: 'Descripcion del activo', type: String })
  descripcion: string;

  @ApiProperty({ description: 'Estado del activo', type: String, example: 'ACTIVO' })
  estado: string;

  @ApiProperty({ description: 'Fecha de registro del activo', type: Date })
  fecha_registro: Date;

  @ApiProperty({ description: 'Categoria (area) a la que pertenece el activo', type: CategoriaDto })
  categoria: CategoriaDto;

  @ApiProperty({
    description: 'Campos propios del detalle del area (varian segun el area del activo)',
    type: 'object',
    additionalProperties: true,
  })
  detalle: Record<string, unknown>;
}

export class PaginatedActivosMetaDto {
  @ApiProperty({ description: 'Pagina actual', type: Number })
  page: number;

  @ApiProperty({ description: 'Cantidad de resultados por pagina', type: Number })
  pageSize: number;

  @ApiProperty({ description: 'Cantidad total de activos que coinciden con el filtro', type: Number })
  total: number;

  @ApiProperty({ description: 'Cantidad total de paginas', type: Number })
  totalPages: number;
}

export class PaginatedActivosDto {
  @ApiProperty({ description: 'Listado de activos', type: [ActivoListItemDto] })
  data: ActivoListItemDto[];

  @ApiProperty({ description: 'Metadatos de paginacion', type: PaginatedActivosMetaDto })
  meta: PaginatedActivosMetaDto;
}
