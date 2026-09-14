import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListActivosQueryDto {
  @ApiPropertyOptional({
    description: 'Numero de pagina',
    type: Number,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por pagina',
    type: Number,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    description:
      'Busqueda libre: filtra por codigo, descripcion y los campos propios del area (contiene, sin distinguir mayusculas)',
    type: String,
    example: 'Dell',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtra por el estado exacto del activo',
    type: String,
    example: 'ACTIVO',
  })
  @IsOptional()
  @IsString()
  estado?: string;
}
