import { CLINICAL_VALIDATORS, RESPONSIBLE_VET_ROLES } from "../permissions";
import { lotBlockReason, pickLotsFEFO } from "../calc";
import { uid } from "../format";
import type { LotAllocation, Prescription } from "../types";
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
