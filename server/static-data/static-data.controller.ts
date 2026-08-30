import { Controller, Get, Header } from "@nestjs/common";
import { StaticDataService } from "./static-data.service";

@Controller("static")
export class StaticDataController {
  constructor(private readonly staticDataService: StaticDataService) {}

  @Get("heroes")
  @Header("Cache-Control", "no-store")
  getHeroes() {
    return this.staticDataService.getHeroes();
  }

  @Get("relic-suits")
  @Header("Cache-Control", "no-store")
  getRelicSuits() {
    return this.staticDataService.getRelicSuits();
  }
}
