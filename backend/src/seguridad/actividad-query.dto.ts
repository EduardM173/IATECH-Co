import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ActividadQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @IsOptional()
  @IsIn(['EXITOSO', 'FALLIDO'])
  resultado?: string;

  @IsIn(['1', '7', '30', 'todos'])
  periodo = '7';
}
