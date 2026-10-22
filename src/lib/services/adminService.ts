import { uid } from "../format";
import { DEMO_PASSWORD } from "../seed/base";
import type { DemoDB, Establishment, Settings, User } from "../types";
import { audit, fail, must, produce, requireOnline, requireRole, type Service } from "./core";

export type UserInput = Pick<User, "name" | "email" | "roleId" | "establishmentId" | "title" | "phone">;

export const createUser: Service<UserInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "administration des utilisateurs");
    if (!input.name.trim()) fail("Nom requis.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) fail("E-mail invalide.");
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fail("Un utilisateur utilise déjà cet e-mail.");
    const id = uid("u");
    d.users.push({ ...input, id, active: true, createdAt: ctx.now.slice(0, 10), demoPassword: DEMO_PASSWORD });
    audit(d, ctx, { module: "Administration", action: "Création d'utilisateur", target: input.name, newValue: input.roleId });
    return { message: `Utilisateur créé (mot de passe de démonstration : ${DEMO_PASSWORD}).`, data: id };
  });

export const updateUser: Service<{ id: string; patch: Partial<UserInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "administration des utilisateurs");
    const u = must(d.users.find((x) => x.id === id));
    if (patch.roleId && u.id === ctx.user.id && patch.roleId !== "dg") fail("Vous ne pouvez pas retirer votre propre rôle DG.");
    const old = u.roleId;
    Object.assign(u, patch);
    audit(d, ctx, { module: "Administration", action: "Modification d'utilisateur", target: u.name, oldValue: old, newValue: u.roleId });
    return { message: "Utilisateur mis à jour." };
  });

/** Désactivation : l'historique (journal, actes, validations) est conservé. */
export const setUserActive: Service<{ id: string; active: boolean; reason: string }> = (db, ctx, { id, active, reason }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "activation / désactivation");
    const u = must(d.users.find((x) => x.id === id));
    if (u.id === ctx.user.id) fail("Vous ne pouvez pas désactiver votre propre compte.");
    if (!reason.trim()) fail("Motif requis.");
    u.active = active;
    audit(d, ctx, { module: "Administration", action: active ? "Réactivation d'utilisateur" : "Désactivation d'utilisateur", target: u.name, oldValue: active ? "Désactivé" : "Actif", newValue: active ? "Actif" : "Désactivé", reason: `${reason} — historique conservé` });
    return { message: active ? "Utilisateur réactivé." : "Utilisateur désactivé (son historique est conservé)." };
  });

export const updateEstablishment: Service<{ id: string; patch: Partial<Omit<Establishment, "id">> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "établissements");
    const e = must(d.establishments.find((x) => x.id === id));
    if (patch.slotMinutes !== undefined && !(patch.slotMinutes >= 5 && patch.slotMinutes <= 240)) fail("Durée de créneau entre 5 et 240 minutes.");
    Object.assign(e, patch);
    audit(d, ctx, { module: "Administration", action: "Modification d'établissement", target: e.name });
    return { message: "Établissement mis à jour." };
  });

export const createEstablishment: Service<Omit<Establishment, "id">, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "établissements");
    if (!input.name.trim()) fail("Nom requis.");
    const id = uid("est");
    d.establishments.push({ ...input, id });
    audit(d, ctx, { module: "Administration", action: "Création d'établissement", target: input.name });
    return { message: "Établissement créé.", data: id };
  });

export const updateSettings: Service<Partial<Settings>> = (db, ctx, patch) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "paramètres");
    if (patch.discountDelegationPct !== undefined || patch.expenseDelegationAmount !== undefined) requireOnline(ctx, "Changement de politique financière");
    if (patch.discountDelegationPct !== undefined && (patch.discountDelegationPct < 0 || patch.discountDelegationPct > 100)) fail("Délégation de remise invalide.");
    const changed = Object.keys(patch).filter((k) => JSON.stringify(d.settings[k as keyof Settings]) !== JSON.stringify(patch[k as keyof Settings]));
    Object.assign(d.settings, patch);
    audit(d, ctx, { module: "Administration", action: "Paramètres modifiés", target: changed.join(", ") || "—" });
    return { message: "Paramètres enregistrés." };
  });

/** Restaure une sauvegarde JSON de démonstration (même version de schéma uniquement). */
export const restoreBackup: Service<{ json: string }> = (db, ctx, { json }) => {
  let parsed: DemoDB;
  try {
    parsed = JSON.parse(json) as DemoDB;
  } catch {
    return { ok: false, error: "Fichier de sauvegarde illisible (JSON invalide)." };
  }
  if (parsed.schemaVersion !== db.schemaVersion || !Array.isArray(parsed.clients) || !Array.isArray(parsed.invoices)) {
    return { ok: false, error: "Sauvegarde invalide ou créée avec une autre version de la démonstration." };
  }
  parsed.audit.unshift({ id: uid("aud"), date: ctx.now, userId: ctx.user.id, module: "Démonstration", action: "Restauration d'une sauvegarde", target: "Environnement complet" });
  return { ok: true, db: parsed, message: "Sauvegarde de démonstration restaurée." };
};

/* ---------------- Suivi des licences (enregistrement, pas de paiement réel) ---------------- */

/** Marque une échéance de licence comme payée — confirmation saisie manuellement. */
export const recordLicencePayment: Service<{ id: string; amount: number; note: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "suivi des licences");
    const l = must(d.licences.find((x) => x.id === input.id));
    if (l.status === "payee") fail("Licence déjà réglée.");
    l.status = "payee";
    l.history.push({ date: ctx.now, userId: ctx.user.id, action: "Paiement confirmé (saisie manuelle — démonstration)", amount: input.amount || l.amount, note: input.note });
    audit(d, ctx, { module: "Administration", action: "Paiement de licence confirmé", target: l.orgName, newValue: String(input.amount || l.amount) });
    return { message: "Paiement de licence enregistré (confirmation manuelle — aucun encaissement réel)." };
  });
