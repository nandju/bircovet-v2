/**
 * Mode hors ligne SIMULÉ. Ne constitue pas un véritable système de synchronisation
 * multi-appareils sécurisé : il permet uniquement de tester les parcours.
 */
import { uid } from "../format";
import type { ActionCtx, DemoDB, EntityRef, SyncOp } from "../types";
import { audit, fail, must, produce, type Service } from "./core";

export function queueIfOffline(d: DemoDB, ctx: ActionCtx, kind: SyncOp["kind"], entity: EntityRef, text: string, label: string, opKey: string) {
  if (!ctx.offline) return;
  if (d.syncQueue.some((o) => o.opKey === opKey)) return; // anti-doublon
  d.syncQueue.unshift({ id: uid("sync"), opKey, date: ctx.now, label, kind, entity, payload: { text }, status: "en_attente", userId: ctx.user.id });
}

function applyStatus(d: DemoDB, op: SyncOp, status: "synchronise" | "conflit" | "en_attente") {
  const noteId = op.opKey;
  if (op.kind === "note_patient") {
    const p = d.patients.find((x) => x.id === op.entity.id);
    const n = p?.notes.find((x) => x.id === noteId);
    if (n) n.syncStatus = status;
  } else if (op.kind === "note_client") {
    const c = d.clients.find((x) => x.id === op.entity.id);
    const n = c?.notes.find((x) => x.id === noteId);
    if (n) n.syncStatus = status;
  } else if (op.kind === "rapport_mission") {
    const m = d.missions.find((x) => x.id === op.entity.id);
    if (m) m.reportSyncStatus = status;
  }
}

/** Simule une modification concurrente côté serveur sur une opération en attente. */
export const simulateRemoteConflict: Service<{ opId: string }> = (db, ctx, { opId }) =>
  produce(db, (d) => {
    const op = must(d.syncQueue.find((o) => o.id === opId));
    if (op.status !== "en_attente") fail("Seule une opération en attente peut recevoir un conflit simulé.");
    op.conflict = { remoteText: `${op.payload.text}\n[Version modifiée sur un autre poste — simulation]`, remoteAuthor: "Autre poste (simulé)" };
    return { message: "Modification concurrente simulée : un conflit apparaîtra à la synchronisation." };
  });

/** Synchronisation idempotente : chaque opKey n'est appliquée qu'une fois. */
export const synchronize: Service<void, { synced: number; conflicts: number }> = (db, ctx) =>
  produce(db, (d) => {
    if (ctx.offline) fail("Rétablissez d'abord la connexion simulée.");
    let synced = 0;
    let conflicts = 0;
    const applied = new Set(d.syncQueue.filter((o) => o.status === "synchronise").map((o) => o.opKey));
    for (const op of d.syncQueue) {
      if (op.status !== "en_attente") continue;
      if (applied.has(op.opKey)) {
        op.status = "synchronise";
        continue; // déjà appliquée : aucun doublon
      }
      if (op.conflict) {
        op.status = "conflit";
        applyStatus(d, op, "conflit");
        conflicts++;
        continue;
      }
      op.status = "synchronise";
      op.syncedAt = ctx.now;
      applied.add(op.opKey);
      applyStatus(d, op, "synchronise");
      synced++;
    }
    audit(d, ctx, { module: "Synchronisation", action: "Synchronisation simulée", target: `${synced} opération(s)`, newValue: `${conflicts} conflit(s)` });
    return {
      message: `${synced} opération(s) synchronisée(s) (simulation)${conflicts ? `, ${conflicts} conflit(s) à résoudre` : ""}.`,
      data: { synced, conflicts },
    };
  });

export const resolveConflict: Service<{ opId: string; keep: "local" | "remote" }> = (db, ctx, { opId, keep }) =>
  produce(db, (d) => {
    const op = must(d.syncQueue.find((o) => o.id === opId));
    if (op.status !== "conflit" || !op.conflict) fail("Aucun conflit à résoudre.");
    const text = keep === "local" ? op.payload.text : op.conflict!.remoteText;
    if (op.kind === "note_patient") {
      const n = d.patients.find((x) => x.id === op.entity.id)?.notes.find((x) => x.id === op.opKey);
      if (n) n.text = text;
    } else if (op.kind === "note_client") {
      const n = d.clients.find((x) => x.id === op.entity.id)?.notes.find((x) => x.id === op.opKey);
      if (n) n.text = text;
    } else {
      const m = d.missions.find((x) => x.id === op.entity.id);
      if (m) m.report = text;
    }
    op.status = "synchronise";
    op.syncedAt = ctx.now;
    applyStatus(d, op, "synchronise");
    audit(d, ctx, { module: "Synchronisation", action: "Résolution manuelle de conflit", target: op.label, decision: keep === "local" ? "Version locale conservée" : "Version distante conservée" });
    return { message: "Conflit résolu manuellement." };
  });

export const clearSynced: Service<void> = (db) =>
  produce(db, (d) => {
    d.syncQueue = d.syncQueue.filter((o) => o.status !== "synchronise");
    return { message: "Historique de synchronisation nettoyé." };
  });
