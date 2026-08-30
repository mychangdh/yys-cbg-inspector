import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { StaticDataController } from "./static-data.controller";
import { StaticDataService } from "./static-data.service";

@Module({
  imports: [DatabaseModule],
  controllers: [StaticDataController],
  providers: [StaticDataService],
})
export class StaticDataModule {}
