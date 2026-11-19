// Scan périodique des règles d'alertes — le SEUL endroit où l'opération
// « alertes.scanner » s'exécute en mode connecté (les navigateurs ne
// l'envoient plus : LOCAL_ONLY_API_OPS côté front).
//
// Le service métier renvoie le nombre de NOUVELLES alertes (déduplication
// par alertLog) : l'état n'est écrit QUE s'il y a réellement du nouveau —
// sinon, aucune écriture, aucune version, aucun rechargement chez les
// postes. Quand une vraie alerte apparaît, version+1 propage l'info à tous
// les postes connectés.
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  executeService, isoLocal, OPERATIONS, refreshDerived, SCHEMA_VERSION,
  type ActionCtx, type DemoDB, type ServiceResult, type User,
} from "@cliva/core";
import { PrismaService } from "../prisma/prisma.service";
import { ClinicStateCache } from "../state/clinic-state-cache.service";

/** Même format que nowIso() du front : « AAAA-MM-JJTHH:mm:ss » en heure locale. */
const serverNowIso = (): string => {
  const d = new Date();
  return `${isoLocal(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const SCAN_OP = "alertes.scanner";
const SCAN_INTERVAL_MS = 15 * 60_000; // toutes les 15 minutes + une fois au démarrage

@Injectable()
export class AlertsScanService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AlertsScanService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClinicStateCache) private readonly cache: ClinicStateCache,
  ) {}

  onModuleInit(): void {
    // Désactivé en tests e2e (NODE_ENV=test sous Jest — déterminisme des
    // versions) et via ALERT_SCAN_DISABLED=1 pour diagnostiquer en prod.
    if (process.env.NODE_ENV === "test" || process.env.ALERT_SCAN_DISABLED === "1") return;
    void this.scanAll();
    this.timer = setInterval(() => void this.scanAll(), SCAN_INTERVAL_MS);
    this.timer.unref(); // ne doit pas empêcher l'arrêt du processus
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Un passage sur TOUTES les cliniques (une écriture possible par clinique). */
  private async scanAll(): Promise<void> {
    if (this.running) return; // un scan long ne doit pas se chevaucher
    this.running = true;
    try {
      const clinics = await this.prisma.clinicState.findMany({ select: { clinicId: true } });
      for (const { clinicId } of clinics) {
        try {
          await this.scanClinic(clinicId);
        } catch (e) {
          this.log.warn(`scan alertes ${clinicId.slice(0, 8)}… : ${e instanceof Error ? e.message : e}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Un passage sur UNE clinique : verrou FOR UPDATE (comme /ops), exécution
   * du service métier, écriture version+1 UNIQUEMENT si de nouvelles alertes
   * ont été produites (result.data = nombre envoyé ; 0 = rien à écrire).
   */
  private async scanClinic(clinicId: string): Promise<void> {
    const def = OPERATIONS[SCAN_OP];
    if (!def) return;
    await this.prisma.$transaction(async (tx) => {
      const { version, data } = await this.cache.forUpdate(tx, clinicId);
      // Acteur système : le premier DG actif de la clinique (auteur des notifications).
      const actor = data.users.find((u: User) => u.roleId === "dg" && u.active) ?? data.users[0];
      if (!actor) return;
      const ctx: ActionCtx = {
        user: actor,
        establishmentId: actor.establishmentId,
        offline: false,
        now: serverNowIso(),
        opKey: randomUUID(),
      };
      const result = executeService(
        def.fn as (db: DemoDB, c: ActionCtx, input: unknown) => ServiceResult<unknown>,
        data,
        ctx,
        {},
      );
      const sent = result.ok ? Number(result.data ?? 0) : 0;
      if (!result.ok || sent === 0) return; // alertLog a déjà dédupliqué : rien de nouveau
      const newData = refreshDerived(result.db, ctx.now.slice(0, 10));
      const v2 = version + 1;
      await tx.clinicState.update({
        where: { clinicId },
        data: { version: v2, schemaVersion: SCHEMA_VERSION, data: newData as object },
      });
      await tx.operation.create({
        data: {
          clinicId,
          opKey: ctx.opKey,
          name: SCAN_OP,
          input: {},
          userId: actor.id,
          clientNow: new Date(),
          status: "ok",
          resultVersion: v2,
        },
      });
      this.cache.set(clinicId, v2, newData);
      this.log.log(`scan alertes ${clinicId.slice(0, 8)}… : ${sent} nouvelle(s) alerte(s) — état v${v2}`);
    });
  }
}
