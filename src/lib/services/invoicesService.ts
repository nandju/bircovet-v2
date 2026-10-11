import { docTotal, invoiceCredited, isActiveInvoice, maxDiscount } from "../calc";
import { addDays, uid } from "../format";
import type { ActionCtx, DemoDB, InvoiceLine, Quote } from "../types";
import { audit, fail, must, nextCode, produce, requireOnline, requireRole, today, type Service } from "./core";

function checkLines(lines: InvoiceLine[]) {
  if (!lines.length) fail("Au moins une ligne est requise.");
  for (const l of lines) {
    if (!l.label.trim()) fail("Chaque ligne doit avoir un libellé.");
    if (!(l.qty > 0)) fail(`Quantité invalide sur « ${l.label} ».`);
    if (l.unitPrice < 0) fail(`Prix invalide sur « ${l.label} ».`);
    if (l.discountPct < 0 || l.discountPct > 100) fail(`Remise invalide sur « ${l.label} ».`);
  }
}

/** Vérifie qu'aucune source (visite) n'est déjà présente sur une facture active ou brouillon. */
function assertSourcesFree(d: DemoDB, lines: InvoiceLine[], ignoreInvoiceId?: string) {
  for (const l of lines) {
    if (!l.source || l.source.kind === "vente") continue;
    const dup = d.invoices.find(
      (i) => i.id !== ignoreInvoiceId && i.kind === "facture" && i.status !== "annulee" && i.lines.some((x) => x.source?.kind === l.source!.kind && x.source?.id === l.source!.id),
    );
    if (dup && l.source.kind === "consultation") fail(`La visite ${l.source.label} est déjà facturée (${dup.code}).`);
  }
}

export function buildInvoice(d: DemoDB, ctx: ActionCtx, i: { clientId: string; lines: InvoiceLine[]; notes?: string; quoteId?: string; dueDays?: number }): string {
  checkLines(i.lines);
  assertSourcesFree(d, i.lines);
  const client = must(d.clients.find((c) => c.id === i.clientId), "Client introuvable.");
  const id = uid("inv");
  const code = nextCode(d, "invoice", d.settings.invoicePrefix);
  d.invoices.unshift({
    id,
    code,
    kind: "facture",
    clientId: client.id,
    payerName: client.payerName || client.name,
    establishmentId: ctx.establishmentId,
    date: today(ctx),
    dueDate: addDays(today(ctx), i.dueDays ?? (client.type === "entreprise" ? 30 : 7)),
    lines: i.lines.map((l) => ({ ...l, id: l.id || uid("il") })),
    status: "brouillon",
    authorId: ctx.user.id,
    creditNoteIds: [],
    quoteId: i.quoteId,
    fiscalStatus: "a_transmettre_backend",
    notes: i.notes ?? "",
  });
  for (const l of i.lines) {
    if (l.source?.kind === "consultation") {
      const c = d.consultations.find((x) => x.id === l.source!.id);
      if (c) {
        c.invoiceId = id;
        c.financialStatus = "facture";
      }
    }
  }
  audit(d, ctx, { module: "Facturation", action: "Création de facture (brouillon)", target: code, newValue: String(docTotal(i.lines)) });
  return id;
}

/* ---------------- Devis ---------------- */

export const createQuote: Service<{ clientId: string; patientId?: string; lines: InvoiceLine[]; validDays: number; notes: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    checkLines(input.lines);
    must(d.clients.find((c) => c.id === input.clientId), "Client requis.");
    const id = uid("quo");
    const code = nextCode(d, "quote", d.settings.quotePrefix);
    d.quotes.unshift({ id, code, clientId: input.clientId, patientId: input.patientId, establishmentId: ctx.establishmentId, date: today(ctx), validUntil: addDays(today(ctx), input.validDays || 30), lines: input.lines, status: "brouillon", authorId: ctx.user.id, notes: input.notes });
    audit(d, ctx, { module: "Facturation", action: "Création de devis", target: code });
    return { message: `Devis ${code} créé.`, data: id };
  });

export const updateQuote: Service<{ id: string; lines: InvoiceLine[]; notes: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const q = must(d.quotes.find((x) => x.id === input.id));
    if (q.status !== "brouillon") fail("Seul un devis brouillon est modifiable.");
    checkLines(input.lines);
    q.lines = input.lines;
    q.notes = input.notes;
    return { message: "Devis enregistré." };
  });

export const setQuoteStatus: Service<{ id: string; status: Quote["status"] }> = (db, ctx, { id, status }) =>
  produce(db, (d) => {
    const q = must(d.quotes.find((x) => x.id === id));
    if (q.status === "converti") fail("Devis déjà converti.");
    q.status = status;
    audit(d, ctx, { module: "Facturation", action: "Statut de devis", target: q.code, newValue: status });
    return { message: status === "envoye" ? "Devis marqué envoyé (simulation — aucun envoi réel)." : "Statut du devis mis à jour." };
  });

export const convertQuote: Service<{ id: string }, string> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const q = must(d.quotes.find((x) => x.id === id));
    if (q.status === "converti") fail("Devis déjà converti en facture.");
    if (q.status !== "accepte") fail("Le devis doit être accepté avant conversion.");
    const invId = buildInvoice(d, ctx, { clientId: q.clientId, lines: q.lines.map((l) => ({ ...l, id: uid("il") })), notes: `Issu du devis ${q.code}`, quoteId: q.id });
    q.status = "converti";
    q.invoiceId = invId;
    return { message: "Devis converti en facture brouillon.", data: invId };
  });

/* ---------------- Factures ---------------- */

export const createInvoice: Service<{ clientId: string; lines: InvoiceLine[]; notes: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "accueil"], "facturation");
    const id = buildInvoice(d, ctx, input);
    return { message: "Facture brouillon créée.", data: id };
  });

export const updateInvoiceDraft: Service<{ id: string; lines: InvoiceLine[]; notes: string; dueDate: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const inv = must(d.invoices.find((x) => x.id === input.id));
    if (inv.status !== "brouillon" && inv.status !== "a_valider") fail("Facture validée : aucune modification silencieuse. Créez un avoir lié.");
    checkLines(input.lines);
    assertSourcesFree(d, input.lines, inv.id);
    inv.lines = input.lines;
    inv.notes = input.notes;
    inv.dueDate = input.dueDate;
    inv.status = "brouillon";
    return { message: "Brouillon de facture enregistré." };
  });

export const submitInvoice: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const inv = must(d.invoices.find((x) => x.id === id));
    if (inv.status !== "brouillon") fail("Seul un brouillon peut être soumis.");
    inv.status = "a_valider";
    return { message: "Facture soumise à validation." };
  });

export const validateInvoice: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "validation de facture");
    requireOnline(ctx, "Validation de facture");
    const inv = must(d.invoices.find((x) => x.id === id));
    if (inv.status !== "brouillon" && inv.status !== "a_valider") fail("Facture déjà validée.");
    const disc = maxDiscount(inv.lines);
    if (disc > d.settings.discountDelegationPct) {
      if (ctx.user.roleId !== "dg") fail(`Remise de ${disc} % hors délégation (${d.settings.discountDelegationPct} %) : validation DG requise.`);
      inv.discountApprovedById = ctx.user.id;
    }
    inv.status = "validee";
    inv.validatedById = ctx.user.id;
    inv.validatedAt = ctx.now;
    audit(d, ctx, { module: "Facturation", action: "Validation de facture", target: inv.code, newValue: String(docTotal(inv.lines)), decision: `Validée par ${ctx.user.name}${inv.discountApprovedById ? " (remise hors délégation approuvée DG)" : ""}` });
    return { message: `Facture ${inv.code} validée. Toute correction passera désormais par un avoir.` };
  });

export const cancelInvoice: Service<{ id: string; reason: string }> = (db, ctx, { id, reason }) =>
  produce(db, (d) => {
    const inv = must(d.invoices.find((x) => x.id === id));
    if (!reason.trim()) fail("Motif requis.");
    if (inv.status !== "brouillon" && inv.status !== "a_valider") fail("Une facture validée ne s'annule pas : créez un avoir lié.");
    inv.status = "annulee";
    inv.correctionReason = reason;
    d.consultations.forEach((c) => {
      if (c.invoiceId === inv.id) {
        c.invoiceId = undefined;
        c.financialStatus = "non_regle";
      }
    });
    d.hospitalizations.forEach((h) => {
      if (h.invoiceId === inv.id) {
        h.invoiceId = undefined;
        h.careActs.forEach((c) => c.billingLine && (c.billingLine.status = "provisoire"));
      }
    });
    audit(d, ctx, { module: "Facturation", action: "Annulation de brouillon", target: inv.code, reason });
    return { message: "Brouillon annulé ; les visites associées redeviennent facturables." };
  });

/** Avoir lié à la facture d'origine (qui reste consultable et inchangée). */
export const createCreditNote: Service<{ invoiceId: string; lines: InvoiceLine[]; reason: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "émission d'avoir");
    requireOnline(ctx, "Émission d'avoir");
    const orig = must(d.invoices.find((x) => x.id === input.invoiceId));
    if (orig.kind !== "facture" || !isActiveInvoice(orig)) fail("Un avoir ne peut être émis que sur une facture validée.");
    if (!input.reason.trim()) fail("Le motif de correction est obligatoire.");
    checkLines(input.lines);
    const amount = docTotal(input.lines);
    const max = docTotal(orig.lines) - invoiceCredited(d, orig.id);
    if (amount > max) fail(`Montant de l'avoir supérieur au montant restant créditable (${max}).`);
    const id = uid("inv");
    const code = nextCode(d, "creditNote", "DEMO-AV");
    d.invoices.unshift({
      id,
      code,
      kind: "avoir",
      clientId: orig.clientId,
      payerName: orig.payerName,
      establishmentId: orig.establishmentId,
      date: today(ctx),
      dueDate: today(ctx),
      lines: input.lines.map((l) => ({ ...l, id: uid("il") })),
      status: "validee",
      authorId: ctx.user.id,
      validatedById: ctx.user.id,
      validatedAt: ctx.now,
      originalInvoiceId: orig.id,
      creditNoteIds: [],
      correctionReason: input.reason,
      fiscalStatus: "a_transmettre_backend",
      notes: `Avoir sur ${orig.code}`,
    });
    orig.creditNoteIds.push(id);
    audit(d, ctx, { module: "Facturation", action: "Émission d'avoir", target: `${code} → ${orig.code}`, newValue: String(amount), reason: input.reason });
    return { message: `Avoir ${code} émis et lié à ${orig.code}.`, data: id };
  });

/* ---------------- Facturation regroupée ---------------- */

export function billableConsultations(db: DemoDB, clientId: string) {
  return db.consultations.filter((c) => c.clientId === clientId && !c.invoiceId && c.acts.length > 0);
}

export const createGroupedInvoice: Service<{ clientId: string; consultationIds: string[] }, string> = (db, ctx, { clientId, consultationIds }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "accueil"], "facturation");
    if (!consultationIds.length) fail("Sélectionnez au moins une visite.");
    const unique = Array.from(new Set(consultationIds));
    if (unique.length !== consultationIds.length) fail("Une visite a été sélectionnée deux fois.");
    const lines: InvoiceLine[] = [];
    for (const cid of unique) {
      const c = must(d.consultations.find((x) => x.id === cid));
      if (c.clientId !== clientId) fail(`${c.code} n'appartient pas à ce payeur.`);
      if (c.invoiceId) fail(`La visite ${c.code} est déjà facturée.`);
      const pName = d.patients.find((p) => p.id === c.patientId)?.name ?? "";
      for (const a of c.acts)
        lines.push({ id: uid("il"), label: `${a.label} — ${pName} (${c.date.slice(0, 10)})`, kind: "service", qty: a.qty, unitPrice: a.unitPrice, discountPct: 0, source: { kind: "consultation", id: c.id, label: c.code } });
    }
    const invId = buildInvoice(d, ctx, { clientId, lines, notes: `Facture regroupée de ${unique.length} visite(s)` });
    return { message: `Facture regroupée créée (${unique.length} visite(s)).`, data: invId };
  });
