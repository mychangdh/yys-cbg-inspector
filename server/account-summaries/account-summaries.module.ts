import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AccountSummariesController } from "./account-summaries.controller";
import { AccountSummariesService } from "./account-summaries.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AccountSummariesController],
  providers: [AccountSummariesService],
})
export class AccountSummariesModule {}
