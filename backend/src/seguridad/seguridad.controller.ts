import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  NotFoundException,
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
    if (process.env.FEATURE_SECURITY_ACTIVITY !== 'true')
      throw new NotFoundException('Función no disponible');
    return this.service.listar(query, request.sessionUser);
  }
}
