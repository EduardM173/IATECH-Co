import { Controller, Get, Inject, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ActivosService } from './activos.service';
import { ParseAreaSlugPipe } from './pipes/parse-area-slug.pipe';
import { AREA_SLUGS } from './types/area-slug.type';
import type { AreaSlug } from './types/area-slug.type';
import { ListActivosQueryDto } from './dto/list-activos-query.dto';
import { ActivoListItemDto, PaginatedActivosDto } from './dto/activo-response.dto';

@ApiTags('Activos')
@Controller('activos')
export class ActivosController {
  constructor(@Inject(ActivosService) private readonly activosService: ActivosService) {}

  @Get(':area/codigo/:codigo')
  @ApiOperation({
    operationId: 'buscarActivoPorCodigo',
    summary: 'Buscar activo por codigo',
    description: 'Devuelve el detalle de un activo del area indicada, buscado por su codigo unico.',
  })
  @ApiParam({ name: 'area', description: 'Area del activo', enum: AREA_SLUGS })
  @ApiParam({ name: 'codigo', description: 'Codigo unico del activo', example: 'HW-0012' })
  @ApiResponse({ status: 200, description: 'Activo encontrado', type: ActivoListItemDto })
  @ApiResponse({ status: 404, description: 'Area invalida o activo no encontrado en esa area' })
  buscarPorCodigo(
    @Param('area', ParseAreaSlugPipe) area: AreaSlug,
    @Param('codigo') codigo: string,
  ) {
    return this.activosService.findByCodigo(area, codigo);
  }

  @Get(':area/:id')
  @ApiOperation({
    operationId: 'verActivoPorId',
    summary: 'Ver detalle de un activo',
    description: 'Devuelve el detalle de un activo del area indicada, buscado por su id.',
  })
  @ApiParam({ name: 'area', description: 'Area del activo', enum: AREA_SLUGS })
  @ApiParam({ name: 'id', description: 'Id del activo', example: 12 })
  @ApiResponse({ status: 200, description: 'Activo encontrado', type: ActivoListItemDto })
  @ApiResponse({ status: 404, description: 'Area invalida o activo no encontrado en esa area' })
  verDetalle(
    @Param('area', ParseAreaSlugPipe) area: AreaSlug,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.activosService.findOne(area, id);
  }

  @Get(':area')
  @ApiOperation({
    operationId: 'listarActivosPorArea',
    summary: 'Listar y buscar activos de un area',
    description:
      'Lista los activos del area indicada de forma paginada. Admite busqueda libre (q), filtro por estado, y filtros por los campos propios del detalle del area (ej. marca, proveedor).',
  })
  @ApiParam({ name: 'area', description: 'Area de los activos', enum: AREA_SLUGS })
  @ApiResponse({ status: 200, description: 'Listado paginado de activos', type: PaginatedActivosDto })
  @ApiResponse({ status: 404, description: 'Area invalida' })
  listar(
    @Param('area', ParseAreaSlugPipe) area: AreaSlug,
    @Query() query: ListActivosQueryDto,
    @Req() req: Request,
  ) {
    return this.activosService.findAll(area, query, req.query as Record<string, unknown>);
  }
}
