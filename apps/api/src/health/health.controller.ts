// GET /api/health : sonde de santé utilisée pour vérifier que l'API
// ET la base de données répondent. Une simple requête SQL (SELECT 1)
// est exécutée ; si elle échoue on renvoie une erreur 503.
// @Public() : la sonde doit rester accessible sans jeton (monitoring).
import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "ok" };
    } catch {
      throw new ServiceUnavailableException({ status: "error", database: "unavailable" });
    }
  }
}
