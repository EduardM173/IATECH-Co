import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { AREA_SLUGS, AreaSlug } from '../types/area-slug.type';

@Injectable()
export class ParseAreaSlugPipe implements PipeTransform<string, AreaSlug> {
  transform(value: string): AreaSlug {
    if (!AREA_SLUGS.includes(value as AreaSlug)) {
      throw new NotFoundException(`Area "${value}" no existe`);
    }
    return value as AreaSlug;
  }
}
