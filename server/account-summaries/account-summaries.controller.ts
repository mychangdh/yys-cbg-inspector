import { Body, Controller, Inject, Post } from "@nestjs/common";
import { AccountSummariesService } from "./account-summaries.service";
import { SaveAccountSummaryDto } from "./save-account-summary.dto";

@Controller("account-summaries")
export class AccountSummariesController {
  constructor(
    @Inject(AccountSummariesService)
    private readonly summaries: AccountSummariesService,
  ) {}

  @Post()
  save(@Body() input: SaveAccountSummaryDto) {
    return this.summaries.save(input);
  }
}
