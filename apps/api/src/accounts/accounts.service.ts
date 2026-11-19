// Gestion des accès (Account) par le DG — sans intervention du développeur.
//
// POST /api/accounts exécute l'opération métier « admin.utilisateur.creer »
// dans la MÊME transaction que la création de l'Account : soit l'utilisateur
// ET son accès existent, soit rien n'est écrit (jamais d'utilisateur sans
// compte ni de compte orphelin).
//
// clinicId et userId viennent UNIQUEMENT du jeton : impossible de créer
// un compte dans une autre clinique.
import { randomUUID } from "node:crypto";
import {
  ConflictException, ForbiddenException, Inject, Injectable, NotFoundException,
} from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import {
  canWith, executeService, isoLocal, OPERATIONS, refreshDerived, SCHEMA_VERSION,
  type ActionCtx, type DemoDB, type ServiceResult, type User,
} from "@cliva/core";
import { PrismaService } from "../prisma/prisma.service";
import { ClinicStateCache } from "../state/clinic-state-cache.service";
import type { AuthUser } from "../auth/current-user.decorator";
import type { CreateAccountDto, ResetPasswordDto } from "./accounts.dto";

/** Même format que nowIso() du front : « AAAA-MM-JJTHH:mm:ss » en heure locale. */
const serverNowIso = (): string => {
  const d = new Date();
  return `${isoLocal(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

// Opération métier de création d'utilisateur — le registre donne son
// module/action de permission (« admin »/« admin », réservé au DG).
const CREATE_USER_OP = "admin.utilisateur.creer";

export interface CreateAccountResponse {
  ok: boolean;
  userId?: string;
  version?: number;
  error?: string;
}

@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClinicStateCache) private readonly cache: ClinicStateCache,
  ) {}

  /**
   * Création d'un accès : opération métier + Account, atomiques.
   * Même protocole que /ops : SELECT version FOR UPDATE, contrôle des droits
   * sur l'état verrouillé, version+1, ligne Operation, cache mis à jour.
   */
  async create(auth: AuthUser, dto: CreateAccountDto): Promise<CreateAccountResponse> {
    // Le hash Argon2 (~1 s) est calculé AVANT la transaction : inutile de
    // garder le verrou de ligne de la clinique pendant ce calcul.
    const passwordHash = await hash(dto.temporaryPassword);

    return this.prisma.$transaction(async (tx) => {
      // Verrou de ligne + état (cache si la version verrouillée correspond).
      const { version: lockedVersion, data: lockedData } = await this.cache.forUpdate(tx, auth.clinicId);
      const lockedUser = lockedData.users.find((u: User) => u.id === auth.userId);
      if (!lockedUser) throw new ForbiddenException("Utilisateur absent de l'état de la clinique");

      const def = OPERATIONS[CREATE_USER_OP];
      if (!canWith(lockedData.settings?.permissions, lockedUser.roleId, def.module, def.action)) {
        throw new ForbiddenException("Action non autorisée pour votre rôle");
      }

      // E-mail de connexion unique — message explicite (contrairement au
      // login, ici le DG DOIT savoir pourquoi la création a été refusée).
      const taken = await tx.account.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (taken) throw new ConflictException("Cet e-mail est déjà utilisé par un autre compte.");

      const opKey = randomUUID();
      const ctx: ActionCtx = {
        user: lockedUser,
        establishmentId: lockedUser.establishmentId,
        offline: false,
        now: serverNowIso(),
        opKey,
      };
      const result = executeService(
        def.fn as (db: DemoDB, c: ActionCtx, input: unknown) => ServiceResult<unknown>,
        lockedData,
        ctx,
        dto.user,
      );

      const opBase = {
        clinicId: auth.clinicId,
        opKey,
        name: CREATE_USER_OP,
        input: dto.user as object,
        userId: lockedUser.id,
        clientNow: new Date(),
      };
      if (!result.ok) {
        // Refus métier (ex. e-mail déjà utilisé par un UTILISATEUR de
        // l'état) : journalisé sans toucher l'état, comme dans /ops.
        await tx.operation.create({
          data: { ...opBase, status: "refused", error: result.error, resultVersion: lockedVersion },
        });
        return { ok: false, error: result.error };
      }

      // Succès : état recalculé + version+1 + ligne Operation — puis
      // l'Account, dans la même transaction.
      const newData = refreshDerived(result.db, ctx.now.slice(0, 10));
      const version = lockedVersion + 1;
      await tx.clinicState.update({
        where: { clinicId: auth.clinicId },
        data: { version, schemaVersion: SCHEMA_VERSION, data: newData as object },
      });
      await tx.operation.create({
        data: { ...opBase, status: "ok", resultVersion: version },
      });
      const newUserId = result.data as string;
      await tx.account.create({
        data: {
          clinicId: auth.clinicId,
          userId: newUserId,
          email: dto.email,
          passwordHash,
          roleId: dto.user.roleId,
          mustChangePassword: true, // le collaborateur choisit son mot de passe à la 1re connexion
        },
      });
      this.cache.set(auth.clinicId, version, newData);
      return { ok: true, userId: newUserId, version };
    });
  }

  /**
   * Nouveau mot de passe temporaire : mustChangePassword repassé à true et
   * TOUTES les sessions du compte révoquées (oblige une reconnexion).
   */
  async resetPassword(auth: AuthUser, userId: string, dto: ResetPasswordDto): Promise<{ ok: true }> {
    const { data } = await this.cache.forRead(this.prisma, auth.clinicId);
    const caller = data.users.find((u: User) => u.id === auth.userId);
    if (!caller || !canWith(data.settings?.permissions, caller.roleId, "admin", "admin")) {
      throw new ForbiddenException("Action non autorisée pour votre rôle");
    }

    const account = await this.prisma.account.findUnique({
      where: { clinicId_userId: { clinicId: auth.clinicId, userId } },
      select: { id: true },
    });
    if (!account) throw new NotFoundException("Aucun compte de connexion associé à cet utilisateur.");

    const passwordHash = await hash(dto.temporaryPassword);
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: account.id },
        data: { passwordHash, mustChangePassword: true, failedLogins: 0, lockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }
}
