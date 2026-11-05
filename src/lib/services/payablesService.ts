import { accountBalance } from "../calc";
import { uid } from "../format";
import { billState, dueFromTerms } from "../payables";
import type { DemoDB, PaymentMethod, Reception, SupplierBill } from "../types";
import { audit, fail, must, nextCode, notify, produce, type Service } from "./core";

export type BillInput = Pick<SupplierBill, "supplierId" | "kind" | "ref" | "label" | "date" | "dueDate" | "amount" | "payAsSold" | "notes"> & { lines?: SupplierBill["lines"] };

export const createBill: Service<BillInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    const sup = must(d.suppliers.find((s) => s.id === input.supplierId), "Fournisseur ou prestataire introuvable.");
    if (!input.label.trim()) fail("Objet de la facture requis.");
    if (!(input.amount > 0)) fail("Montant requis.");
    if (input.dueDate < input.date) fail("L'échéance ne peut pas précéder la date de facture.");
    if (input.ref.trim() && (d.bills ?? []).some((b) => b.supplierId === sup.id && b.ref === input.ref.trim() && b.status !== "annulee")) fail("Cette facture fournisseur est déjà enregistrée.");
    const id = uid("bill");
    const code = nextCode(d, "bill", "DET");
    d.bills = d.bills ?? [];
    d.bills.unshift({ ...input, ref: input.ref.trim(), label: input.label.trim(), lines: input.lines ?? [], id, code, payments: [], status: "ouverte", createdAt: ctx.now, createdById: ctx.user.id });
    audit(d, ctx, { module: "Dettes", action: "Facture fournisseur", target: `${code} — ${sup.name}` });
    return { message: `Dette ${code} enregistrée (échéance ${input.dueDate}).`, data: id };
  });

/** Facture d'achat créée automatiquement à la validation d'une réception (dette fournisseur). */
export function billFromReception(d: DemoDB, ctx: { user: { id: string }; now: string }, rec: Reception) {
  if ((d.bills ?? []).some((b) => b.receptionId === rec.id)) return;
  const lines = rec.lines.filter((l) => l.qtyReceived > 0 && l.check?.status !== "refuse").map((l) => ({ productId: l.productId, qty: l.qtyReceived, unitCost: l.unitCost }));
  const amount = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  if (!amount) return;
  const sup = d.suppliers.find((s) => s.id === rec.supplierId);
  const date = ctx.now.slice(0, 10);
  d.counters.bill = (d.counters.bill ?? 0) + 1;
  d.bills = d.bills ?? [];
  d.bills.unshift({ id: uid("bill"), code: `DET-${String(d.counters.bill).padStart(4, "0")}`, supplierId: rec.supplierId, kind: "achat_stock", ref: rec.deliveryNoteRef, label: `Réception ${rec.code}`, date, dueDate: dueFromTerms(date, sup?.paymentTerms), amount, receptionId: rec.id, lines, payAsSold: true, payments: [], status: "ouverte", createdAt: ctx.now, createdById: ctx.user.id });
}

export const payBill: Service<{ id: string; amount: number; accountId: string; method: PaymentMethod; reference: string; date?: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!["dg", "comptable", "accueil"].includes(ctx.user.roleId)) fail("Paiement réservé au DG, à l'accueil-caisse ou au comptable.");
    const b = must((d.bills ?? []).find((x) => x.id === input.id));
    if (b.status !== "ouverte") fail("Facture soldée ou annulée.");
    const st = billState(d, b, ctx.now.slice(0, 10));
    if (!(input.amount > 0)) fail("Montant invalide.");
    const max = b.kind === "depot_vente" ? Math.max(0, b.amount - st.paid) : st.remaining;
    if (input.amount > max + 0.5) fail(`Le montant dépasse le reste à payer (${max} FCFA).`);
    must(d.accounts.find((a) => a.id === input.accountId), "Compte introuvable.");
    if (accountBalance(d, input.accountId) < input.amount) fail("Solde du compte insuffisant pour ce paiement.");
    b.payments.push({ id: uid("bpay"), date: input.date || ctx.now, amount: input.amount, accountId: input.accountId, method: input.method, reference: input.reference.trim(), byId: ctx.user.id });
    const after = billState(d, b, ctx.now.slice(0, 10));
    if (b.kind !== "depot_vente" && after.remaining <= 0) b.status = "soldee";
    if (b.kind === "depot_vente" && after.paid >= b.amount) b.status = "soldee";
    const sup = d.suppliers.find((s) => s.id === b.supplierId);
    audit(d, ctx, { module: "Dettes", action: "Paiement fournisseur", target: `${b.code} — ${sup?.name}`, newValue: `${input.amount} FCFA` });
    if (ctx.user.roleId !== "dg") notify(d, ctx, { title: `Paiement fournisseur : ${sup?.name}`, body: `${input.amount.toLocaleString("fr-FR")} FCFA réglés sur ${b.code} par ${ctx.user.name}.`, level: "info", toRoles: ["dg"], link: "/achats/dettes" });
    return { message: b.status === "soldee" ? `${b.code} soldée.` : "Paiement enregistré." };
  });

export const cancelBill: Service<{ id: string; reason: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    if (ctx.user.roleId !== "dg") fail("Seul le DG annule une dette.");
    const b = must((d.bills ?? []).find((x) => x.id === input.id));
    if (b.payments.length) fail("Des paiements existent : annulation impossible.");
    if (!input.reason.trim()) fail("Motif requis.");
    b.status = "annulee";
    b.notes = `${b.notes ? `${b.notes}\n` : ""}Annulée : ${input.reason.trim()}`;
    return { message: "Dette annulée." };
  });

export const setPayAsSold: Service<{ id: string; on: boolean }> = (db, _ctx, input) =>
  produce(db, (d) => {
    const b = must((d.bills ?? []).find((x) => x.id === input.id));
    b.payAsSold = input.on;
    return { message: input.on ? "Remboursement au fil des ventes activé." : "Remboursement à l'échéance." };
  });
