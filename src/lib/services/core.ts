/**
 * Socle des services simulés.
 * Chaque service est une fonction pure : (db, ctx, input) => ServiceResult.
 * Point d'intégration futur : remplacer l'implémentation par des appels API
 * en conservant les mêmes signatures côté composants.
 */
import { deriveInvoiceStatus } from "../calc";
import { uid } from "../format";
import type { ActionCtx, AppNotification, AuditEntry, DemoDB, RoleId, ServiceResult } from "../types";

export type Service<I, T = undefined> = (db: DemoDB, ctx: ActionCtx, input: I) => ServiceResult<T>;

export class ServiceError extends Error {}

/** Exécute une mutation sur une copie profonde de la base. */
export function produce<T = undefined>(
  db: DemoDB,
  fn: (draft: DemoDB) => { message?: string; data?: T } | void,
): ServiceResult<T> {
  const draft = structuredClone(db);
  try {
    const out = fn(draft) || {};
    return { ok: true, db: draft, message: out.message, data: out.data };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    throw e;
  }
}

export function fail(msg: string): never {
  throw new ServiceError(msg);
}

export function must<T>(v: T | undefined | null, msg = "Élément introuvable."): T {
  if (v === undefined || v === null) fail(msg);
  return v as T;
}

export function requireRole(ctx: ActionCtx, roles: RoleId[], what: string) {
  if (!roles.includes(ctx.user.roleId)) fail(`Action réservée (${what}). Profil actuel non autorisé dans la simulation.`);
}

export function requireOnline(ctx: ActionCtx, what: string) {
  if (ctx.offline) fail(`${what} : indisponible en mode hors ligne (simulation). Rétablissez la connexion simulée.`);
}

export function nextCode(draft: DemoDB, key: string, prefix: string, width = 4): string {
  const n = (draft.counters[key] ?? 0) + 1;
  draft.counters[key] = n;
  return `${prefix}-${String(n).padStart(width, "0")}`;
}

export function audit(draft: DemoDB, ctx: ActionCtx, e: Omit<AuditEntry, "id" | "date" | "userId">) {
  draft.audit.unshift({ id: uid("aud"), date: ctx.now, userId: ctx.user.id, ...e });
  if (draft.audit.length > 800) draft.audit.length = 800;
}

export function notify(draft: DemoDB, ctx: ActionCtx, n: Omit<AppNotification, "id" | "date" | "read">) {
  draft.notifications.unshift({ id: uid("ntf"), date: ctx.now, read: false, ...n });
  if (draft.notifications.length > 100) draft.notifications.length = 100;
}

export const today = (ctx: ActionCtx) => ctx.now.slice(0, 10);

/** Recalcule les données dérivées persistées (statuts de paiement…). */
export function refreshDerived(db: DemoDB, todayIso: string): DemoDB {
  let changed = false;
  const invoices = db.invoices.map((inv) => {
    const s = deriveInvoiceStatus(db, inv, todayIso);
    if (s !== inv.status) {
      changed = true;
      return { ...inv, status: s };
    }
    return inv;
  });
  const lots = db.lots.map((l) => {
    if (l.status === "disponible" && l.expiryDate < todayIso) {
      changed = true;
      return { ...l, status: "perime" as const };
    }
    return l;
  });
  return changed ? { ...db, invoices, lots } : db;
}

export const positive = (n: number, label: string) => {
  if (!Number.isFinite(n) || n <= 0) fail(`${label} doit être un nombre strictement positif.`);
};
