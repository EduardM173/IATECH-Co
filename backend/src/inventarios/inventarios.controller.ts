import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { InventariosService } from './inventarios.service';

@Controller('inventarios')
@UseGuards(SessionGuard)
export class InventariosController {
  constructor(
    @Inject(InventariosService) private readonly service: InventariosService,
  ) {}
  @Get(':area/metadatos')
  metadata(@Param('area') area: string) {
    return this.service.metadata(area);
  }
  @Get(':area')
  list(@Param('area') area: string, @Query() query: Record<string, unknown>) {
    return this.service.list(area, query);
  }
  @Post(':area')
  create(
    @Param('area') area: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    if (request.sessionUser.rol !== 'ADMIN')
      throw new ForbiddenException(
        'Solo el administrador puede registrar activos',
      );
    return this.service.save(area, body);
  }
  @Patch(':area/:id')
  update(
    @Param('area') area: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    if (request.sessionUser.rol !== 'ADMIN')
      throw new ForbiddenException(
        'Solo el administrador puede modificar activos',
      );
    return this.service.save(area, body, id);
  }
}
@Controller('reportes')
@UseGuards(SessionGuard)
export class ReportesController {
  constructor(
    @Inject(InventariosService) private readonly service: InventariosService,
  ) {}
  @Post(':area')
  report(@Param('area') area: string, @Body() body: Record<string, unknown>) {
    return this.service.report(area, body);
  }
}
@Controller('bi')
@UseGuards(SessionGuard)
export class BIController {
  constructor(
    @Inject(InventariosService) private readonly service: InventariosService,
  ) {}
  @Get(':area/exportar')
  async export(
    @Param('area') area: string,
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const buffer = await this.service.export(area, query);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="inventario-' + area + '.xlsx"',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }
}
