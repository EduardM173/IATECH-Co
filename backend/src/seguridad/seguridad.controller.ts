import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { ActividadQueryDto } from './actividad-query.dto';
import { SeguridadService } from './seguridad.service';

@Controller('seguridad')
@UseGuards(SessionGuard)
export class SeguridadController {
  constructor(
    @Inject(SeguridadService) private readonly service: SeguridadService,
  ) {}

  @Get('actividad')
  listar(
    @Query(
      new ValidationPipe({
        expectedType: ActividadQueryDto,
        transform: true,
        whitelist: true,
      }),
    )
    query: ActividadQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.listar(query, request.sessionUser);
  }
}
