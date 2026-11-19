// Routes de lecture de l'état de la clinique.
// L'utilisateur vient UNIQUEMENT du jeton JWT (@CurrentUser) — jamais de
// paramètre de requête pour choisir une clinique ou un utilisateur.
import { Controller, ForbiddenException, Get, Inject, NotFoundException } from "@nestjs/common";
import { redactForRole, type User } from "@cliva/core";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { ClinicStateCache } from "./clinic-state-cache.service";

@Controller("state")
export class StateController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClinicStateCache) private readonly cache: ClinicStateCache,
  ) {}

  // GET /api/state : état complet, filtré selon le rôle (jamais de salaires,
  // platform ni demoPassword pour un rôle non autorisé). La version est relue
  // en base à chaque appel ; data vient du cache quand la version n'a pas
  // bougé — ~1 Mo de lecture Neon économisé par requête.
  @Get()
  async getState(@CurrentUser() auth: AuthUser) {
    const { version, data } = await this.cache.forRead(this.prisma, auth.clinicId);
    const user = data.users.find((u: User) => u.id === auth.userId);
    if (!user) throw new ForbiddenException("Utilisateur absent de l'état de la clinique");
    return { version, data: redactForRole(data, user) };
  }

  // GET /api/state/version : juste le numéro de version — quelques octets
  // lus, pour que le front vérifie périodiquement si son état est à jour.
  @Get("version")
  async getVersion(@CurrentUser() auth: AuthUser) {
    const row = await this.prisma.clinicState.findUnique({
      where: { clinicId: auth.clinicId },
      select: { version: true },
    });
    if (!row) throw new NotFoundException("État de la clinique introuvable");
    return { version: row.version };
  }
}
