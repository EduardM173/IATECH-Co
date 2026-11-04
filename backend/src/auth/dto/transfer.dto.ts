import { IsIn, Matches } from 'class-validator';

export class CreateTransferDto {
  @IsIn(['seguridad', 'software', 'bigdata', 'calidad', 'redes', 'hardware', 'cloud'])
  area: string;
}

export class ExchangeTransferDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code: string;
}
