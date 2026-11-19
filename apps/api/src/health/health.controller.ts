// GET /api/health : sonde de santé utilisée pour vérifier que l'API
// ET la base de données répondent. Une simple requête SQL (SELECT 1)
// est exécutée ; si elle échoue on renvoie une erreur 503.
// @Public() : la sonde doit rester accessible sans jeton (monitoring).
import { Controller, ForbiddenException, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ClinicStateCache } from "../state/clinic-state-cache.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClinicStateCache) private readonly cache: ClinicStateCache,
  ) {}

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

  // GET /api/health/usage : compteurs de lecture de clinic_states.data
  // depuis le démarrage — suivi de la consommation Neon. Réservé au DG
  // (métrique interne, les autres rôles n'ont pas à la voir).
  @Get("usage")
  usage(@CurrentUser() auth: AuthUser) {
    if (auth.roleId !== "dg") throw new ForbiddenException("Réservé à la direction");
    return this.cache.usage();
  }
}
