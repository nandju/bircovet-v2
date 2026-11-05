import { CLINICAL_VALIDATORS, RESPONSIBLE_VET_ROLES } from "../permissions";
import { lotBlockReason, pickLotsFEFO } from "../calc";
import { uid } from "../format";
import type { DemoDB, LotAllocation, Prescription } from "../types";
import { audit, fail, must, nextCode, positive, produce, requireRole, today, type Service } from "./core";
import { applyMovement } from "./inventoryService";

export type PrescriptionInput = Pick<
  Prescription,
  "patientId" | "consultationId" | "hospitalizationId" | "productId" | "form" | "route" | "quantity" | "dose" | "frequency" | "duration" | "instructions" | "vetId"
>;

export const delivered = (p: Prescription) => p.deliveries.reduce((s, x) => s + x.qty, 0);
export const remaining = (p: Prescription) => p.quantity - delivered(p);

/** Une prescription ne crée JAMAIS de mouvement de stock. */
export const createPrescription: Service<PrescriptionInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "prescription");
    positive(input.quantity, "La quantité prescrite");
    if (!input.dose.trim()) fail("La dose doit être saisie par le professionnel (aucune dose n'est proposée automatiquement).");
    const vet = must(d.users.find((u) => u.id === input.vetId), "Responsable clinique requis.");
    if (!RESPONSIBLE_VET_ROLES.includes(vet.roleId)) fail("Le responsable clinique doit être un vétérinaire habilité.");
    const patient = must(d.patients.find((p) => p.id === input.patientId));
    if (patient.vitalStatus === "decede") fail("Animal décédé.");
    must(d.products.find((p) => p.id === input.productId), "Produit introuvable.");
    const id = uid("rx");
    const code = nextCode(d, "prescription", "ORD");
    d.prescriptions.unshift({ ...input, id, code, clientId: patient.ownerId, authorId: ctx.user.id, date: ctx.now, status: "brouillon", deliveries: [] });
    audit(d, ctx, { module: "Prescriptions", action: "Création (brouillon)", target: `${code} — ${patient.name}` });
    return { message: `Prescription ${code} créée en brouillon. Le stock n'est pas modifié.`, data: id };
  });

export type OrderLineInput = Pick<Prescription, "productId" | "form" | "route" | "quantity" | "dose" | "frequency" | "duration" | "instructions">;

export interface OrderInput {
  patientId: string;
  consultationId?: string;
  hospitalizationId?: string;
  vetId: string;
  lines: OrderLineInput[];
  note?: string;
  /** Ordonnance faite après une vente au comptoir : les produits sont déjà remis. */
  sale?: { invoiceId: string };
}

/** Lignes d'une même ordonnance (une prescription seule forme une ordonnance d'une ligne). */
export const orderLines = (db: DemoDB, p: Prescription): Prescription[] =>
  p.orderId ? db.prescriptions.filter((x) => x.orderId === p.orderId).sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0)) : [p];

/** Ordonnance de plusieurs médicaments : une ligne de prescription par médicament, un seul numéro. */
export const createPrescriptionOrder: Service<OrderInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet"], "prescription");
    const lines = input.lines.filter((l) => l.productId);
    if (!lines.length) fail("Ajoutez au moins un médicament.");
    lines.forEach((l, i) => {
      positive(l.quantity, `La quantité du médicament ${i + 1}`);
      if (!l.dose.trim()) fail(`Médicament ${i + 1} : la dose doit être saisie par le professionnel.`);
      must(d.products.find((p) => p.id === l.productId), `Médicament ${i + 1} : produit introuvable.`);
    });
    const vet = must(d.users.find((u) => u.id === input.vetId), "Responsable clinique requis.");
    if (!RESPONSIBLE_VET_ROLES.includes(vet.roleId)) fail("Le responsable clinique doit être un vétérinaire habilité.");
    const patient = must(d.patients.find((p) => p.id === input.patientId), "Choisissez l'animal.");
    if (patient.vitalStatus === "decede") fail("Animal décédé.");
    const orderId = uid("ord");
    const orderCode = nextCode(d, "prescription", "ORD");
    const note = input.note?.trim() || undefined;
    const rows: Prescription[] = lines.map((l, i) => {
      const sold = !!input.sale;
      return {
        ...l,
        patientId: patient.id,
        consultationId: input.consultationId,
        hospitalizationId: input.hospitalizationId,
        vetId: vet.id,
        id: uid("rx"),
        code: lines.length > 1 ? `${orderCode}-${i + 1}` : orderCode,
        orderId,
        orderCode,
        lineNo: i + 1,
        orderNote: note,
        clientId: patient.ownerId,
        authorId: ctx.user.id,
        date: ctx.now,
        status: sold ? "delivree" : "brouillon",
        validatedById: sold ? ctx.user.id : undefined,
        saleInvoiceId: input.sale?.invoiceId,
        deliveries: sold ? [{ id: uid("dl"), date: ctx.now, qty: l.quantity, allocations: [], userId: ctx.user.id, movementIds: [], opKey: `sale-${input.sale!.invoiceId}-${i}`, kind: "delivrance" }] : [],
      };
    });
    d.prescriptions.unshift(...rows);
    audit(d, ctx, { module: "Prescriptions", action: input.sale ? "Ordonnance après vente" : "Création (brouillon)", target: `${orderCode} — ${patient.name} — ${rows.length} médicament(s)` });
    return { message: `Ordonnance ${orderCode} créée : ${rows.length} médicament(s)${input.sale ? ", déjà remis à la vente" : " en brouillon. Le stock n'est pas modifié"}.`, data: orderId };
  });

/** Valider d'un coup toutes les lignes encore à valider d'une ordonnance. */
export const validatePrescriptionOrder: Service<{ orderId: string }> = (db, ctx, { orderId }) =>
  produce(db, (d) => {
    requireRole(ctx, CLINICAL_VALIDATORS, "validation de prescription");
    const list = d.prescriptions.filter((x) => x.orderId === orderId && (x.status === "brouillon" || x.status === "a_valider"));
    if (!list.length) fail("Rien à valider sur cette ordonnance.");
    for (const p of list) {
      p.status = "validee";
      p.validatedById = ctx.user.id;
    }
    audit(d, ctx, { module: "Prescriptions", action: "Validation", target: list[0].orderCode ?? list[0].code, decision: `${list.length} ligne(s) validée(s) par ${ctx.user.name}` });
    return { message: `Ordonnance ${list[0].orderCode ?? ""} validée (${list.length} médicament(s)).` };
  });

export const submitPrescription: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const p = must(d.prescriptions.find((x) => x.id === id));
    if (p.status !== "brouillon") fail("Seul un brouillon peut être soumis.");
    p.status = "a_valider";
    return { message: "Prescription soumise à validation." };
  });

export const validatePrescription: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, CLINICAL_VALIDATORS, "validation de prescription");
    const p = must(d.prescriptions.find((x) => x.id === id));
    if (p.status !== "brouillon" && p.status !== "a_valider") fail("Prescription déjà traitée.");
    p.status = "validee";
    p.validatedById = ctx.user.id;
    audit(d, ctx, { module: "Prescriptions", action: "Validation", target: p.code, decision: `Validée par ${ctx.user.name}` });
    return { message: `Prescription validée par ${ctx.user.name}. Stock inchangé tant qu'aucune délivrance n'est confirmée.` };
  });

export const cancelPrescription: Service<{ id: string; reason: string }> = (db, ctx, { id, reason }) =>
  produce(db, (d) => {
    requireRole(ctx, CLINICAL_VALIDATORS, "annulation de prescription");
    const p = must(d.prescriptions.find((x) => x.id === id));
    if (!reason.trim()) fail("Motif requis.");
    if (p.status === "delivree") fail("Prescription entièrement délivrée : annulation impossible.");
    p.status = "annulee";
    audit(d, ctx, { module: "Prescriptions", action: "Annulation", target: p.code, reason, newValue: `Reliquat non délivré : ${remaining(p)}` });
    return { message: "Prescription annulée (les délivrances déjà effectuées restent tracées)." };
  });

/**
 * Délivrance (ou administration) confirmée : seul cet acte produit un mouvement de stock.
 * - quantité ≤ reliquat ;
 * - lots périmés / en quarantaine refusés ;
 * - FEFO par défaut, choix manuel possible ;
 * - idempotence via opKey.
 */
export const deliverPrescription: Service<{ id: string; qty: number; opKey: string; lotId?: string; kind?: "delivrance" | "administration" }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "assistant", "accueil"], "délivrance");
    const p = must(d.prescriptions.find((x) => x.id === input.id));
    if (p.deliveries.some((x) => x.opKey === input.opKey)) return { message: "Opération déjà enregistrée — aucun double mouvement." };
    if (p.status !== "validee" && p.status !== "partiellement_delivree") fail("Seule une prescription validée peut être délivrée.");
    positive(input.qty, "La quantité délivrée");
    const rest = remaining(p);
    if (input.qty > rest) fail(`Quantité supérieure au reliquat (${rest}).`);
    let allocations: LotAllocation[];
    if (input.lotId) {
      const lot = must(d.lots.find((l) => l.id === input.lotId));
      if (lot.productId !== p.productId) fail("Ce lot ne correspond pas au produit prescrit.");
      const reason = lotBlockReason(lot, today(ctx));
      if (reason) fail(`Délivrance bloquée : ${reason}`);
      if (lot.qtyAvailable < input.qty) fail(`Quantité insuffisante sur ${lot.ref}.`);
      allocations = [{ lotId: lot.id, qty: input.qty }];
    } else {
      const pick = pickLotsFEFO(d, p.productId, ctx.establishmentId, input.qty, today(ctx));
      if (!pick.ok) fail(pick.error);
      allocations = (pick as { allocations: LotAllocation[] }).allocations;
    }
    const kind = input.kind ?? "delivrance";
    const movementIds = allocations.map((a, k) =>
      applyMovement(d, ctx, { lotId: a.lotId, type: kind, qty: -a.qty, ref: { kind: "prescription", id: p.id }, note: `${kind === "delivrance" ? "Délivrance" : "Administration"} ${p.code}`, opKey: `${input.opKey}-${k}` }),
    );
    p.deliveries.push({ id: uid("dl"), date: ctx.now, qty: input.qty, allocations, userId: ctx.user.id, movementIds, opKey: input.opKey, kind });
    p.status = remaining(p) === 0 ? "delivree" : "partiellement_delivree";
    audit(d, ctx, { module: "Prescriptions", action: kind === "delivrance" ? "Délivrance confirmée" : "Administration confirmée", target: p.code, newValue: `${input.qty} (reliquat : ${remaining(p)})` });
    return { message: `${input.qty} unité(s) délivrée(s). Reliquat : ${remaining(p)}.` };
  });
