import { Module } from "@nestjs/common";
import { CbgController } from "./cbg.controller";
import { CbgService } from "./cbg.service";

@Module({
  controllers: [CbgController],
  providers: [CbgService],
})
export class CbgModule {}
