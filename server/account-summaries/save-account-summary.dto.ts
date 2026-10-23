import { IsNotEmpty, IsString, IsUrl, MaxLength } from "class-validator";

export class SaveAccountSummaryDto {
  @IsString()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  productUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  summary!: string;
}
