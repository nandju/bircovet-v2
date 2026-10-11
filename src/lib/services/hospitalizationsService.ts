import { daysBetween, uid } from "../format";
import { pickLotsFEFO } from "../calc";
import type { Hospitalization, InvoiceLine, LotAllocation } from "../types";
import { audit, fail, must, nextCode, produce, requireRole, today, type Service } from "./core";
import { applyMovement } from "./inventoryService";
import { buildInvoice } from "./invoicesService";

export interface AdmitInput {
  patientId: string;
  reason: string;
  cage: string;
  vetId: string;
  consentSigned: boolean;
  consentBy: string;
  quoteId?: string;
  dailyRate: number;
}

export const admitPatient: Service<AdmitInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "admission");
    const p = must(d.patients.find((x) => x.id === input.patientId));
    if (p.vitalStatus === "decede") fail("Animal décédé.");
    if (d.hospitalizations.some((h) => h.patientId === p.id && h.status === "en_cours")) fail("Ce patient a déjà un séjour en cours.");
    if (!input.cage) fail("Emplacement requis.");
    if (d.hospitalizations.some((h) => h.status === "en_cours" && h.cage === input.cage && h.establishmentId === ctx.establishmentId)) fail("Emplacement déjà occupé.");
    if (!input.reason.trim()) fail("Motif d'admission requis.");
    const id = uid("hosp");
    const code = nextCode(d, "hospitalization", "HOSP");
    d.hospitalizations.unshift({
      id,
      code,
      patientId: p.id,
      clientId: p.ownerId,
      establishmentId: ctx.establishmentId,
      admittedAt: ctx.now,
      reason: input.reason,
      consent: { signed: input.consentSigned, signedBy: input.consentBy, date: input.consentSigned ? ctx.now : undefined },
      cage: input.cage,
      quoteId: input.quoteId,
      vetId: input.vetId,
      carePlan: [],
      observations: [],
      transmissions: [],
      careActs: [],
      status: "en_cours",
      dailyRate: input.dailyRate,
    });
    audit(d, ctx, { module: "Hospitalisation", action: "Admission", target: `${code} — ${p.name}`, newValue: input.cage });
    return { message: `Admission ${code} enregistrée.`, data: id };
  });

const getOpen = (d: { hospitalizations: Hospitalization[] }, id: string) => {
  const h = must(d.hospitalizations.find((x) => x.id === id));
  if (h.status !== "en_cours") fail("Séjour non actif : action impossible.");
  return h;
};

export const addObservation: Service<{ id: string; text: string }> = (db, ctx, { id, text }) =>
  produce(db, (d) => {
    if (!text.trim()) fail("Observation vide.");
    getOpen(d, id).observations.unshift({ id: uid("obs"), date: ctx.now, authorId: ctx.user.id, text });
    return { message: "Observation horodatée ajoutée." };
  });

export const addTransmission: Service<{ id: string; text: string; shift: string }> = (db, ctx, { id, text, shift }) =>
  produce(db, (d) => {
    if (!text.trim()) fail("Transmission vide.");
    getOpen(d, id).transmissions.unshift({ id: uid("trn"), date: ctx.now, authorId: ctx.user.id, text, shift });
    return { message: "Transmission enregistrée." };
  });

export const addCarePlanItem: Service<{ id: string; label: string; schedule: string }> = (db, ctx, { id, label, schedule }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "plan de soins");
    if (!label.trim()) fail("Libellé requis.");
    getOpen(d, id).carePlan.push({ id: uid("cp"), label, schedule, done: false });
    return { message: "Élément ajouté au plan de soins." };
  });

export const toggleCarePlan: Service<{ id: string; itemId: string }> = (db, ctx, { id, itemId }) =>
  produce(db, (d) => {
    const it = must(getOpen(d, id).carePlan.find((c) => c.id === itemId));
    it.done = !it.done;
  });

/**
 * Soin effectué : peut consommer un produit (mouvement unique, idempotent)
 * et proposer une ligne PROVISOIRE de facturation (jamais facturée deux fois).
 */
export const recordCareAct: Service<{ id: string; label: string; productId?: string; qty?: number; billing?: { label: string; qty: number; unitPrice: number }; opKey: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "assistant"], "réalisation de soins");
    const h = getOpen(d, input.id);
    if (h.careActs.some((c) => c.opKey === input.opKey)) return { message: "Soin déjà enregistré — aucun doublon." };
    if (!input.label.trim()) fail("Libellé du soin requis.");
    let movementId: string | undefined;
    if (input.productId) {
      const qty = input.qty ?? 0;
      if (!(qty > 0)) fail("Quantité de produit invalide.");
      const pick = pickLotsFEFO(d, input.productId, h.establishmentId, qty, today(ctx));
      if (!pick.ok) fail(pick.error);
      const allocs = (pick as { allocations: LotAllocation[] }).allocations;
      movementId = allocs.map((a, k) => applyMovement(d, ctx, { lotId: a.lotId, type: "administration", qty: -a.qty, ref: { kind: "hospitalisation", id: h.id }, note: `Soin ${h.code} — ${input.label}`, opKey: `${input.opKey}-${k}` }))[0];
    }
    h.careActs.unshift({
      id: uid("ca"),
      date: ctx.now,
      authorId: ctx.user.id,
      label: input.label,
      productId: input.productId,
      qty: input.qty,
      movementId,
      billingLine: input.billing ? { ...input.billing, status: "provisoire" } : undefined,
      opKey: input.opKey,
    });
    return { message: input.productId ? "Soin enregistré ; consommation de produit tracée (une seule fois)." : "Soin enregistré." };
  });

export const setConsent: Service<{ id: string; signedBy: string }> = (db, ctx, { id, signedBy }) =>
  produce(db, (d) => {
    if (!signedBy.trim()) fail("Nom du signataire requis.");
    const h = getOpen(d, id);
    h.consent = { signed: true, signedBy, date: ctx.now };
    audit(d, ctx, { module: "Hospitalisation", action: "Consentement enregistré", target: h.code });
    return { message: "Consentement enregistré." };
  });

/** Sortie médicale : ne clôture PAS le solde financier. */
export const dischargePatient: Service<{ id: string; notes: string; followUpDate?: string; followUpNotes?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "sortie médicale");
    const h = getOpen(d, input.id);
    if (!input.notes.trim()) fail("Compte rendu de sortie requis.");
    h.status = "sortie_medicale";
    h.dischargedAt = ctx.now;
    h.dischargeNotes = input.notes;
    if (input.followUpDate) h.followUp = { date: input.followUpDate, notes: input.followUpNotes ?? "", done: false };
    if (input.followUpDate)
      d.tasks.unshift({ id: uid("tsk"), title: `Suivi post-sortie ${h.code}`, description: input.followUpNotes || "Suivi après hospitalisation", assigneeId: h.vetId, priority: "normale", dueDate: input.followUpDate, status: "a_faire", category: "suivi_hospitalisation", clientId: h.clientId, patientId: h.patientId, result: "", history: [{ date: ctx.now, userId: ctx.user.id, action: "Tâche créée à la sortie médicale" }] });
    audit(d, ctx, { module: "Hospitalisation", action: "Sortie médicale", target: h.code, reason: "Le solde financier reste distinct" });
    return { message: "Sortie médicale enregistrée. Le solde financier reste à traiter séparément." };
  });

export function stayDays(h: Hospitalization, now: string): number {
  return Math.max(1, daysBetween(h.admittedAt.slice(0, 10), (h.dischargedAt ?? now).slice(0, 10)) + 1);
}

export function provisionalLines(h: Hospitalization, now: string): InvoiceLine[] {
  const src = { kind: "hospitalisation" as const, id: h.id, label: h.code };
  const lines: InvoiceLine[] = [{ id: `hl-${h.id}-days`, label: "Hospitalisation (forfait journalier)", kind: "service", qty: stayDays(h, now), unitPrice: h.dailyRate, discountPct: 0, source: src }];
  for (const c of h.careActs) if (c.billingLine?.status === "provisoire") lines.push({ id: `hl-${c.id}`, label: c.billingLine.label, kind: c.productId ? "produit" : "service", productId: c.productId, qty: c.billingLine.qty, unitPrice: c.billingLine.unitPrice, discountPct: 0, source: src });
  return lines;
}

/** Préfacturation : crée une facture brouillon, chaque ligne provisoire passe « facturée » une seule fois. */
export const invoiceStay: Service<{ id: string }, string> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "accueil"], "préfacturation");
    const h = must(d.hospitalizations.find((x) => x.id === id));
    if (h.invoiceId) fail("Ce séjour a déjà une facture associée.");
    const lines = provisionalLines(h, ctx.now);
    const invId = buildInvoice(d, ctx, { clientId: h.clientId, lines, notes: `Séjour ${h.code}` });
    h.careActs.forEach((c) => c.billingLine && (c.billingLine.status = "facturee"));
    h.invoiceId = invId;
    audit(d, ctx, { module: "Hospitalisation", action: "Préfacturation", target: h.code });
    return { message: "Facture brouillon créée à partir des lignes provisoires.", data: invId };
  });

export const closeStay: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const h = must(d.hospitalizations.find((x) => x.id === id));
    if (h.status !== "sortie_medicale") fail("La sortie médicale doit précéder la clôture.");
    const inv = h.invoiceId ? d.invoices.find((i) => i.id === h.invoiceId) : undefined;
    if (!inv || inv.status !== "payee") fail("Clôture impossible : le séjour doit être facturé et soldé.");
    h.status = "cloture";
    audit(d, ctx, { module: "Hospitalisation", action: "Clôture administrative", target: h.code });
    return { message: "Séjour clôturé." };
  });

export const completeFollowUp: Service<{ id: string; notes: string }> = (db, ctx, { id, notes }) =>
  produce(db, (d) => {
    const h = must(d.hospitalizations.find((x) => x.id === id));
    if (!h.followUp) fail("Aucun suivi programmé.");
    h.followUp.done = true;
    h.followUp.notes = notes || h.followUp.notes;
    return { message: "Suivi post-sortie réalisé." };
  });
