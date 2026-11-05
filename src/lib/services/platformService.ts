import { extendCoverage } from "../platform";
import { isHttpUrl } from "../protocols";
import { uid } from "../format";
import type { ActionCtx, AdCampaign, DemoDB, PlatformClinic, PlatformOffer, PlatformState } from "../types";
import { fail, must, produce, type Service } from "./core";

function requireEditor(ctx: ActionCtx) {
  if (ctx.user.roleId !== "editeur") fail("Réservé à l'éditeur de la plateforme Cliva.");
}
const plat = (d: DemoDB): PlatformState => must(d.platform, "Plateforme non initialisée.");

export type ClinicInput = Omit<PlatformClinic, "id" | "payments" | "usage" | "createdAt" | "isSelf"> & { id?: string };

export const saveClinic: Service<ClinicInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireEditor(ctx);
    if (!input.name.trim()) fail("Nom de la clinique requis.");
    if (!(input.licencePrice >= 0) || !(input.maintenanceAmount >= 0)) fail("Montants invalides.");
    const p = plat(d);
    const clean = { ...input, name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim() };
    if (input.id) {
      const c = must(p.clinics.find((x) => x.id === input.id));
      Object.assign(c, clean);
      return { message: "Clinique mise à jour.", data: c.id };
    }
    const id = uid("clin");
    p.clinics.push({ ...clean, id, payments: [], usage: [], createdAt: ctx.now.slice(0, 10) });
    return { message: `${clean.name} ajoutée.`, data: id };
  });

/** Encaissement : licence (vente directe, éventuellement en plusieurs fois) ou maintenance (prolonge la couverture). */
export const recordPlatformPayment: Service<{ clinicId: string; kind: "licence" | "maintenance"; amount: number; date: string; periods?: number; note?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireEditor(ctx);
    if (!(input.amount > 0)) fail("Montant requis.");
    const c = must(plat(d).clinics.find((x) => x.id === input.clinicId), "Clinique introuvable.");
    const pay = { id: uid("lpay"), date: input.date || ctx.now.slice(0, 10), amount: input.amount, kind: input.kind, note: input.note?.trim() || undefined } as PlatformClinic["payments"][number];
    if (input.kind === "licence") {
      if (!c.soldAt) c.soldAt = pay.date;
      if (c.status === "prospect") c.status = "actif";
      // La vente de la licence ouvre la première période de maintenance si aucune n'existe.
      if (!c.paidUntil) c.paidUntil = extendCoverage({ ...c, paidUntil: undefined }, pay.date);
    } else {
      c.paidUntil = extendCoverage(c, pay.date, Math.max(1, input.periods ?? 1));
      pay.coversUntil = c.paidUntil;
      if (c.status === "suspendu") c.status = "actif";
    }
    c.payments.push(pay);
    return { message: input.kind === "licence" ? "Paiement de licence enregistré." : `Maintenance prolongée jusqu'au ${c.paidUntil?.split("-").reverse().join("/")}.` };
  });

export const setClinicStatus: Service<{ id: string; status: PlatformClinic["status"]; note?: string }> = (db, ctx, { id, status, note }) =>
  produce(db, (d) => {
    requireEditor(ctx);
    const c = must(plat(d).clinics.find((x) => x.id === id));
    if (status === "suspendu" && !note?.trim()) fail("Indiquez le motif de la suspension.");
    c.status = status;
    if (note?.trim()) c.notes = `${c.notes ? `${c.notes}\n` : ""}${ctx.now.slice(0, 10)} : ${note.trim()}`;
    return { message: status === "suspendu" ? "Clinique suspendue (le support et les mises à jour sont arrêtés ; ses données restent les siennes)." : "Clinique réactivée." };
  });

export type CampaignInput = Omit<AdCampaign, "id" | "stats" | "createdAt"> & { id?: string };

export const saveCampaign: Service<CampaignInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireEditor(ctx);
    if (!input.title.trim()) fail("Titre requis.");
    if (!input.placements.length) fail("Choisissez au moins un emplacement.");
    if (input.link && !input.link.startsWith("/") && !isHttpUrl(input.link)) fail("Lien invalide (https://… ou une page de l'application).");
    if (input.from && input.to && input.to < input.from) fail("La date de fin précède la date de début.");
    const p = plat(d);
    const clean = { ...input, title: input.title.trim(), sponsor: input.sponsor.trim(), text: input.text.trim(), link: input.link?.trim() || undefined };
    if (input.id) {
      const c = must(p.campaigns.find((x) => x.id === input.id));
      Object.assign(c, clean);
      return { message: "Campagne mise à jour.", data: c.id };
    }
    const id = uid("cmp");
    p.campaigns.unshift({ ...clean, id, stats: {}, createdAt: ctx.now.slice(0, 10) });
    return { message: "Campagne créée : elle s'affiche dans les cliniques ciblées.", data: id };
  });

export const deleteCampaign: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireEditor(ctx);
    const p = plat(d);
    p.campaigns = p.campaigns.filter((c) => c.id !== id);
    return { message: "Campagne supprimée." };
  });

/** Vue ou clic d'une campagne dans une clinique (comptage seulement). */
export const trackCampaign: Service<{ id: string; clinicId: string; kind: "view" | "click" }> = (db, _ctx, { id, clinicId, kind }) =>
  produce(db, (d) => {
    const c = d.platform?.campaigns.find((x) => x.id === id);
    if (!c) return;
    const s = (c.stats[clinicId] = c.stats[clinicId] ?? { views: 0, clicks: 0 });
    if (kind === "view") s.views += 1;
    else s.clicks += 1;
  });

export const saveOffer: Service<PlatformOffer> = (db, ctx, input) =>
  produce(db, (d) => {
    requireEditor(ctx);
    if (!(input.licencePrice >= 0) || !(input.maintenanceAmount >= 0)) fail("Montants invalides.");
    plat(d).offer = { ...input, graceDays: Math.max(0, Math.round(input.graceDays)) };
    return { message: "Offre enregistrée : elle sert de base aux nouvelles cliniques." };
  });
