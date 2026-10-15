import {
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { ActivosService } from './activos.service';
import { ListActivosQueryDto } from './dto/list-activos-query.dto';
import {
  InventarioListItemDto,
  PaginatedInventarioDto,
} from './dto/activo-response.dto';
import { ParseAreaSlugPipe } from './pipes/parse-area-slug.pipe';
import { AREA_SLUGS } from './types/area-slug.type';
import type { AreaSlug } from './types/area-slug.type';

@ApiTags('Inventario')
@Controller('activos')
@UseGuards(SessionGuard)
export class ActivosController {
  constructor(
    @Inject(ActivosService) private readonly activosService: ActivosService,
  ) {}

  @Get(':area/:id')
  @ApiOperation({ summary: 'Ver un registro del inventario de un area' })
  @ApiParam({ name: 'area', enum: AREA_SLUGS })
  @ApiParam({ name: 'id', example: 12 })
  @ApiResponse({ status: 200, type: InventarioListItemDto })
  verDetalle(
    @Param('area', ParseAreaSlugPipe) area: AreaSlug,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.activosService.findOne(area, req.sessionUser.id_categoria, id);
  }

  @Get(':area')
  @ApiOperation({
    summary: 'Listar el inventario aislado por area',
    description:
      'El area solicitada debe coincidir con el area del usuario autenticado.',
  })
  @ApiParam({ name: 'area', enum: AREA_SLUGS })
  @ApiResponse({ status: 200, type: PaginatedInventarioDto })
  listar(
    @Param('area', ParseAreaSlugPipe) area: AreaSlug,
    @Query(
      new ValidationPipe({
        expectedType: ListActivosQueryDto,
        transform: true,
        whitelist: true,
      }),
    )
    query: ListActivosQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.activosService.findAll(
      area,
      req.sessionUser.id_categoria,
      query,
      req.query,
    );
  }
}
