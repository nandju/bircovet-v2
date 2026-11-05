import { migrateToV6 } from "../followup";
import { migrateToV7 } from "../rural";
import { migrateToV8 } from "../pharma/state";
import { migrateToV9 } from "../clientActivity";
import { migrateToV10 } from "../announcements";
import { migrateToV11 } from "../migrateV11";
import { migrateToV12 } from "../migrateV12";
import { migrateToV13 } from "../migrateV13";
import { migrateToV14 } from "../migrateV14";
import { migrateToV15 } from "../migrateV15";
import { migrateToV16 } from "../migrateV16";
import { migrateToV17 } from "../migrateV17";
import { migrateToV18 } from "../migrateV18";
import { migrateToV19 } from "../migrateV19";
import { migrateToV20 } from "../migrateV20";
import { migrateToV21 } from "../migrateV21";
import { migrateToV22 } from "../migrateV22";
import { migrateToV23 } from "../migrateV23";
import { uid } from "../format";
import { DEMO_PASSWORD } from "../seed/base";
import type { Announcement, DemoDB, Establishment, RoleId, Settings, User } from "../types";
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
  if ((parsed.schemaVersion !== db.schemaVersion && parsed.schemaVersion !== 5 && parsed.schemaVersion !== 6 && parsed.schemaVersion !== 7 && parsed.schemaVersion !== 8 && parsed.schemaVersion !== 9 && parsed.schemaVersion !== 10 && parsed.schemaVersion !== 11 && parsed.schemaVersion !== 12 && parsed.schemaVersion !== 13 && parsed.schemaVersion !== 14 && parsed.schemaVersion !== 15 && parsed.schemaVersion !== 16 && parsed.schemaVersion !== 17 && parsed.schemaVersion !== 18 && parsed.schemaVersion !== 19 && parsed.schemaVersion !== 20 && parsed.schemaVersion !== 21 && parsed.schemaVersion !== 22) || !Array.isArray(parsed.clients) || !Array.isArray(parsed.invoices)) {
    return { ok: false, error: "Sauvegarde invalide ou créée avec une autre version de la démonstration." };
  }
  if (parsed.schemaVersion === 5) parsed = migrateToV6(parsed, ctx.now.slice(0, 10));
  if (parsed.schemaVersion === 6) parsed = migrateToV7(parsed, ctx.now);
  if (parsed.schemaVersion === 7) parsed = migrateToV8(parsed);
  if (parsed.schemaVersion === 8) parsed = migrateToV9(parsed, ctx.now.slice(0, 10));
  if (parsed.schemaVersion === 9) parsed = migrateToV10(parsed, ctx.now.slice(0, 10));
  if (parsed.schemaVersion === 10) parsed = migrateToV11(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 11) parsed = migrateToV12(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 12) parsed = migrateToV13(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 13) parsed = migrateToV14(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 14) parsed = migrateToV15(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 15) parsed = migrateToV16(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 16) parsed = migrateToV17(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 17) parsed = migrateToV18(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 18) parsed = migrateToV19(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 19) parsed = migrateToV20(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 20) parsed = migrateToV21(parsed, ctx.now.slice(0, 16));
  if (parsed.schemaVersion === 21) parsed = migrateToV22(parsed);
  if (parsed.schemaVersion === 22) parsed = migrateToV23(parsed);
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

/* ---------------- Annonces et actualités ---------------- */

export type AnnouncementInput = Omit<Announcement, "id" | "createdAt" | "views" | "clicks" | "order"> & { id?: string };

export const saveAnnouncement: Service<AnnouncementInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "annonces");
    if (!input.title.trim() && !input.imageDataUrl) fail("Ajoutez au moins un titre ou une image.");
    if (!input.placements.length) fail("Choisissez où afficher l'annonce.");
    if (input.from && input.to && input.to < input.from) fail("La date de fin précède la date de début.");
    if (input.link && !(input.link.startsWith("/") || /^https?:\/\//.test(input.link))) fail("Lien : une route interne (/stock) ou une adresse commençant par https://");
    if (!d.announcements) d.announcements = [];
    if (input.id) {
      const a = must(d.announcements.find((x) => x.id === input.id), "Annonce introuvable.");
      Object.assign(a, { ...input, title: input.title.trim(), text: input.text.trim() });
      audit(d, ctx, { module: "Annonces", action: "Modification", target: a.title });
      return { message: "Annonce enregistrée.", data: a.id };
    }
    const id = uid("ann");
    d.announcements.push({ ...input, id, title: input.title.trim(), text: input.text.trim(), createdAt: ctx.now.slice(0, 10), views: 0, clicks: 0, order: d.announcements.reduce((m, a) => Math.max(m, a.order), 0) + 1 });
    audit(d, ctx, { module: "Annonces", action: "Création", target: input.title });
    return { message: "Annonce publiée.", data: id };
  });

export const deleteAnnouncement: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "annonces");
    const a = must((d.announcements ?? []).find((x) => x.id === id), "Annonce introuvable.");
    d.announcements = d.announcements!.filter((x) => x.id !== id);
    audit(d, ctx, { module: "Annonces", action: "Suppression", target: a.title });
    return { message: "Annonce supprimée." };
  });

export const moveAnnouncement: Service<{ id: string; dir: -1 | 1 }> = (db, _ctx, { id, dir }) =>
  produce(db, (d) => {
    const list = [...(d.announcements ?? [])].sort((a, b) => a.order - b.order);
    const i = list.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { message: "" };
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
    return { message: "" };
  });

/** Statistiques de diffusion (vues, clics) — sans journal d'audit. */
export const trackAnnouncement: Service<{ id: string; kind: "view" | "click" }> = (db, _ctx, { id, kind }) =>
  produce(db, (d) => {
    if (id.startsWith("cmp:")) {
      const c = d.platform?.campaigns.find((x) => x.id === id.slice(4));
      const me = d.platform?.clinics.find((x) => x.isSelf);
      if (c && me) {
        const s = (c.stats[me.id] = c.stats[me.id] ?? { views: 0, clicks: 0 });
        if (kind === "view") s.views += 1;
        else s.clicks += 1;
      }
      return;
    }
    const a = (d.announcements ?? []).find((x) => x.id === id);
    if (a) a[kind === "view" ? "views" : "clicks"] += 1;
  });

/* ---------- Rôles, autorisations, catégories (réglages du DG) ---------- */

export const setRolePermission: Service<{ role: RoleId; module: string; letters: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG modifie les autorisations.");
    if (input.role === "dg" && input.module === "admin") fail("Le DG conserve toujours l'administration.");
    if (!/^[rcuvea]*$/.test(input.letters)) fail("Droits invalides.");
    // Toute action suppose la lecture.
    const l = input.letters && !input.letters.includes("r") ? `r${input.letters}` : input.letters;
    d.settings.permissions = { ...(d.settings.permissions ?? {}), [input.role]: { ...(d.settings.permissions?.[input.role] ?? {}), [input.module]: l } };
    audit(d, ctx, { module: "Administration", action: "Autorisations", target: `${input.role} · ${input.module} = ${l || "aucun"}` });
    return { message: "Autorisation mise à jour." };
  });

export const resetRolePermissions: Service<{ role: RoleId }> = (db, ctx, { role }) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG modifie les autorisations.");
    const p = { ...(d.settings.permissions ?? {}) };
    delete p[role];
    d.settings.permissions = p;
    return { message: "Droits par défaut rétablis pour ce rôle." };
  });

export const setRoleLabel: Service<{ role: RoleId; label: string; description: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG renomme les rôles.");
    if (!input.label.trim()) fail("Nom du rôle requis.");
    d.settings.roleLabels = { ...(d.settings.roleLabels ?? {}), [input.role]: { label: input.label.trim(), description: input.description.trim() } };
    return { message: "Rôle mis à jour." };
  });

export const setUserRole: Service<{ userId: string; roleId: RoleId; title?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG attribue les rôles.");
    const u = must(d.users.find((x) => x.id === input.userId));
    if (u.id === ctx.user.id && input.roleId !== "dg") fail("Vous ne pouvez pas retirer votre propre rôle de DG.");
    u.roleId = input.roleId;
    if (input.title?.trim()) u.title = input.title.trim();
    audit(d, ctx, { module: "Administration", action: "Changement de rôle", target: `${u.name} → ${input.roleId}` });
    return { message: `${u.name} : rôle mis à jour.` };
  });

export const saveCategories: Service<{ labels: Record<string, string>; details: Record<string, string[]>; expenseCategories: string[]; expenseDetails: Record<string, string[]>; productCategories?: string[]; reassign?: Record<string, string> }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG modifie les catégories.");
    if (input.productCategories) {
      const list = [...new Set(input.productCategories.map((x) => x.trim()).filter(Boolean))];
      if (!list.length) fail("Gardez au moins une catégorie de produits.");
      // Une catégorie retirée qui contient des produits doit les transférer vers une catégorie gardée.
      let moved = 0;
      for (const p of d.products) {
        if (list.includes(p.category)) continue;
        const to = input.reassign?.[p.category];
        if (!to || !list.includes(to)) fail(`La catégorie « ${input.labels[p.category] || p.category} » contient encore des produits : choisissez où les déplacer.`);
        p.category = to;
        if (p.subCategory && !(input.details[to] ?? []).includes(p.subCategory)) p.subCategory = undefined;
        moved++;
      }
      for (const c of list) if (!input.labels[c]?.trim() && !/^(medicament|vaccin|antiparasitaire|consommable|aliment|materiel)$/.test(c)) fail("Donnez un nom à chaque nouvelle catégorie.");
      d.settings.productCategories = list;
      if (moved) audit(d, ctx, { module: "Stock", action: "Catégories fusionnées", target: `${moved} produit(s) déplacé(s)` });
    }
    const exp = [...new Set(input.expenseCategories.map((x) => x.trim()).filter(Boolean))];
    if (!exp.length) fail("Au moins une catégorie de dépense.");
    const clean = (m: Record<string, string[]>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...new Set(v.map((x) => x.trim()).filter(Boolean))]]));
    d.settings.categoryLabels = Object.fromEntries(Object.entries(input.labels).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    d.settings.categoryDetails = clean(input.details);
    d.settings.expenseCategories = exp;
    d.settings.expenseDetails = clean(Object.fromEntries(Object.entries(input.expenseDetails).filter(([k]) => exp.includes(k))));
    audit(d, ctx, { module: "Administration", action: "Catégories", target: "Catégories et précisions" });
    return { message: "Catégories enregistrées." };
  });

export const saveRevenueFamilies: Service<{ families: import("../types").RevenueFamily[] }> = (db, ctx, { families }) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG organise les familles de recettes.");
    const clean = families.map((f) => ({ ...f, name: f.name.trim(), keys: [...new Set(f.keys)], monthlyTarget: f.monthlyTarget && f.monthlyTarget > 0 ? f.monthlyTarget : undefined }));
    if (clean.some((f) => !f.name)) fail("Chaque famille doit avoir un nom.");
    if (new Set(clean.map((f) => f.name.toLowerCase())).size !== clean.length) fail("Deux familles portent le même nom.");
    // Une source n'appartient qu'à une seule famille.
    const seen = new Set<string>();
    for (const f of clean) f.keys = f.keys.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
    d.settings.revenueFamilies = clean;
    audit(d, ctx, { module: "Rapports", action: "Familles de recettes", target: `${clean.length} famille(s)` });
    return { message: "Familles de recettes enregistrées." };
  });
