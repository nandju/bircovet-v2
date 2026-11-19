// Exécution idempotente des opérations métier (le cœur de l'API).
//
// Principe : la MÊME fonction de service qui tourne dans le navigateur
// (exécution optimiste) tourne ici, côté serveur, sur l'état en base —
// c'est le serveur qui fait foi, le client recharge ensuite l'état validé.
import {
  BadRequestException, ForbiddenException, Inject, Injectable,
} from "@nestjs/common";
import {
  canWith, executeService, isoLocal, OPERATIONS, refreshDerived, SCHEMA_VERSION,
  type ActionCtx, type DemoDB, type ServiceResult, type User,
} from "@cliva/core";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClinicStateCache } from "../state/clinic-state-cache.service";
import type { AuthUser } from "../auth/current-user.decorator";
import type { OpDto } from "./ops.dto";

/** Même format que nowIso() du front : « AAAA-MM-JJTHH:mm:ss » en heure locale. */
const serverNowIso = (): string => {
  const d = new Date();
  return `${isoLocal(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

export interface OpResponse {
  ok: boolean;
  version?: number;
  message?: string;
  data?: unknown;
  error?: string;
  /** true = l'opKey avait déjà été traitée : réponse rejouée, rien réexécuté. */
  replayed?: boolean;
}

@Injectable()
export class OpsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClinicStateCache) private readonly cache: ClinicStateCache,
  ) {}

  async execute(auth: AuthUser, dto: OpDto): Promise<OpResponse> {
    // 1) IDEMPOTENCE : cette opKey a-t-elle déjà été traitée pour cette clinique ?
    //    Seules les colonnes nécessaires à la réponse sont relues — jamais
    //    le champ `input` (potentiellement volumineux).
    const existing = await this.prisma.operation.findUnique({
      where: { clinicId_opKey: { clinicId: auth.clinicId, opKey: dto.opKey } },
      select: { status: true, resultVersion: true, error: true },
    });
    if (existing) {
      return {
        ok: existing.status === "ok",
        version: existing.resultVersion ?? undefined,
        error: existing.error ?? undefined,
        replayed: true,
      };
    }

    // 2) L'opération doit exister dans le registre partagé (jamais de clé libre).
    const def = OPERATIONS[dto.name];
    if (!def) throw new BadRequestException(`Opération inconnue : ${dto.name}`);

    // Lecture de contrôle avant la transaction (l'état est relu VERROUILLÉ
    // dans la transaction : cette première lecture sert à répondre vite
    // aux cas interdits). Via le cache : la version seule est relue,
    // data n'est rechargée que si elle a changé (~1 Mo économisé).
    const { data } = await this.cache.forRead(this.prisma, auth.clinicId);
    const user = data.users.find((u: User) => u.id === auth.userId);
    if (!user) throw new ForbiddenException("Utilisateur absent de l'état de la clinique");

    // 3) Droits : canWith est la version pure (sans état global) de can() —
    //    elle lit la matrice depuis l'état lui-même.
    if (!canWith(data.settings?.permissions, user.roleId, def.module, def.action)) {
      throw new ForbiddenException("Action non autorisée pour votre rôle");
    }

    return this.prisma.$transaction(async (tx) => {
      // 4) VERROU de ligne : SELECT version ... FOR UPDATE sérialise les
      //    opérations de cette clinique (deux requêtes simultanées ne peuvent
      //    pas écrire deux états incompatibles). La version seule est lue ;
      //    data vient du cache si la version verrouillée correspond.
      const { version: lockedVersion, data: lockedData } = await this.cache.forUpdate(tx, auth.clinicId);
      const lockedUser = lockedData.users.find((u: User) => u.id === auth.userId);
      if (!lockedUser) throw new ForbiddenException("Utilisateur absent de l'état de la clinique");
      // Le contrôle de droits est refait sur l'état VERROUILLÉ (il a pu changer).
      if (!canWith(lockedData.settings?.permissions, lockedUser.roleId, def.module, def.action)) {
        throw new ForbiddenException("Action non autorisée pour votre rôle");
      }

      // Même ctx qu'au navigateur : user, establishmentId, offline, now, opKey.
      const ctx: ActionCtx = {
        user: lockedUser,
        establishmentId: lockedUser.establishmentId,
        offline: false,
        now: serverNowIso(),
        opKey: dto.opKey,
      };

      // executeService installe le générateur d'ids déterministe (opKey).
      // (cast : le registre stocke les services sous une forme générique
      // — ici on sait que fn(input) est la signature réelle.)
      const result = executeService(
        def.fn as (db: DemoDB, c: ActionCtx, input: unknown) => ServiceResult<unknown>,
        lockedData,
        ctx,
        dto.input,
      );

      const opBase = {
        clinicId: auth.clinicId,
        opKey: dto.opKey,
        name: dto.name,
        input: dto.input as object,
        userId: lockedUser.id,
        clientNow: new Date(dto.clientNow),
      };

      if (result.ok) {
        // 5a) Succès : état recalculé (refreshDerived comme le front), version+1.
        const newData = refreshDerived(result.db, ctx.now.slice(0, 10));
        const version = lockedVersion + 1;
        await tx.clinicState.update({
          where: { clinicId: auth.clinicId },
          data: { version, schemaVersion: SCHEMA_VERSION, data: newData as object },
        });
        await tx.operation.create({
          data: { ...opBase, status: "ok", resultVersion: version },
        });
        // L'état écrit devient la référence du cache (executeService a
        // produit une nouvelle base — l'entrée cachée n'a pas été mutée).
        this.cache.set(auth.clinicId, version, newData);
        // Activation/désactivation d'un utilisateur : l'accès (Account) suit
        // dans la MÊME transaction — un utilisateur désactivé ne peut plus
        // se connecter et ses sessions ouvertes sont révoquées.
        if (dto.name === "admin.utilisateur.actif") await this.syncAccountActive(tx, auth.clinicId, dto.input);
        return { ok: true, version, message: result.message, data: result.data };
      }

      // 5b) Refus métier : on journalise l'opération SANS toucher l'état.
      await tx.operation.create({
        data: { ...opBase, status: "refused", error: result.error, resultVersion: lockedVersion },
      });
      return { ok: false, version: lockedVersion, error: result.error };
    });
  }

  /** Répercute l'activation/désactivation métier sur l'accès (login + sessions). */
  private async syncAccountActive(
    tx: Prisma.TransactionClient,
    clinicId: string,
    input: unknown,
  ): Promise<void> {
    const { id, active } = (input ?? {}) as { id?: string; active?: boolean };
    if (typeof id !== "string" || typeof active !== "boolean") return;
    const account = await tx.account.findUnique({
      where: { clinicId_userId: { clinicId, userId: id } },
      select: { id: true },
    });
    if (!account) return; // utilisateur sans accès (compte jamais créé) : rien à faire
    await tx.account.update({ where: { id: account.id }, data: { active } });
    if (!active) {
      await tx.refreshToken.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
}
