import { IsNotEmpty, IsString, Matches } from "class-validator";

export class GetEquipDetailQuery {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  serverid!: string;

  @IsString()
  @IsNotEmpty()
  ordersn!: string;
}
