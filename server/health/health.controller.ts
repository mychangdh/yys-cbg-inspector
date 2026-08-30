import { Controller, Get, Header, Inject } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async getHealth() {
    await this.databaseService.ping();
    return {
      status: 1,
      data: { service: "yys-cbg-api", database: "connected" },
    };
  }
}
