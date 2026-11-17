// Routes de lecture de l'état de la clinique.
// L'utilisateur vient UNIQUEMENT du jeton JWT (@CurrentUser) — jamais de
// paramètre de requête pour choisir une clinique ou un utilisateur.
import { Controller, ForbiddenException, Get, Inject, NotFoundException } from "@nestjs/common";
import { redactForRole, type DemoDB, type User } from "@cliva/core";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("state")
export class StateController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Retrouve le User métier (dans l'état JSON) correspondant au compte du jeton. */
  private async stateForUser(auth: AuthUser) {
    const state = await this.prisma.clinicState.findUnique({ where: { clinicId: auth.clinicId } });
    if (!state) throw new NotFoundException("État de la clinique introuvable");
    const data = state.data as unknown as DemoDB;
    const user = data.users.find((u: User) => u.id === auth.userId);
    if (!user) throw new ForbiddenException("Utilisateur absent de l'état de la clinique");
    return { version: state.version, data, user };
  }

  // GET /api/state : état complet, filtré selon le rôle (jamais de salaires,
  // platform ni demoPassword pour un rôle non autorisé).
  @Get()
  async getState(@CurrentUser() auth: AuthUser) {
    const { version, data, user } = await this.stateForUser(auth);
    return { version, data: redactForRole(data, user) };
  }

  // GET /api/state/version : juste le numéro de version — léger, pour que le
  // front vérifie périodiquement si son état local est à jour.
  @Get("version")
  async getVersion(@CurrentUser() auth: AuthUser) {
    const { version } = await this.stateForUser(auth);
    return { version };
  }
}
