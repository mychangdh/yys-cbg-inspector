import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

export const CBG_CHANNELS = [
  "official",
  "huawei",
  "oppo",
  "vivo",
  "xiaomi",
] as const;

export type CbgChannel = (typeof CBG_CHANNELS)[number];

export class GetEquipDetailQuery {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  serverid!: string;

  @IsString()
  @IsNotEmpty()
  ordersn!: string;

  @IsOptional()
  @IsIn(CBG_CHANNELS)
  channel?: CbgChannel;
}
