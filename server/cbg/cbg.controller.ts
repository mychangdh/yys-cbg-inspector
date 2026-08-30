import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import { CbgService } from "./cbg.service";
import { GetEquipDetailQuery } from "./get-equip-detail.query";

@Controller("cbg")
export class CbgController {
  constructor(@Inject(CbgService) private readonly cbgService: CbgService) {}

  @Get("get_equip_detail")
  @Header("Cache-Control", "no-store")
  getEquipDetail(
    @Query(
      new ValidationPipe({
        expectedType: GetEquipDetailQuery,
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: GetEquipDetailQuery,
  ) {
    return this.cbgService.getEquipDetail(query.serverid, query.ordersn);
  }
}
