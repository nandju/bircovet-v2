/** Encaissements SIMULÉS : aucun mouvement d'argent réel. */
import { invoiceBalance, isActiveInvoice, paymentUnallocated, receivablePaid } from "../calc";
import { uid } from "../format";
import type { Payment, PaymentMethod } from "../types";
import { audit, fail, must, nextCode, positive, produce, today, type Service } from "./core";

export interface PaymentInput {
  clientId: string;
  amount: number;
  method: PaymentMethod;
  accountId: string;
  kind: Payment["kind"];
  allocations: { invoiceId?: string; receivableId?: string; amount: number }[];
  reference: string;
  note: string;
  opKey: string;
}

export const recordPayment: Service<PaymentInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    const existing = d.payments.find((p) => p.opKey === input.opKey);
    if (existing) return { message: "Paiement déjà enregistré — aucun double comptage.", data: existing.id };
    positive(input.amount, "Le montant");
    must(d.clients.find((c) => c.id === input.clientId), "Client requis.");
    const acc = must(d.accounts.find((a) => a.id === input.accountId), "Compte d'encaissement requis.");
    if (input.method === "especes" && acc.type !== "caisse") fail("Un paiement en espèces doit être affecté à une caisse.");
    if (input.method === "mobile_money" && acc.type !== "mobile_money") fail("Un paiement Mobile Money doit être affecté à un compte Mobile Money (simulé).");
    const allocated = input.allocations.reduce((s, a) => s + a.amount, 0);
    if (allocated > input.amount) fail("Le total affecté dépasse le montant encaissé.");
    for (const a of input.allocations) {
      if (a.amount <= 0) fail("Montant d'affectation invalide.");
      if (a.invoiceId) {
        const inv = must(d.invoices.find((i) => i.id === a.invoiceId));
        if (inv.clientId !== input.clientId) fail(`${inv.code} n'appartient pas à ce client.`);
        if (inv.kind !== "facture" || !isActiveInvoice(inv)) fail(`${inv.code} n'est pas une facture validée.`);
        const bal = invoiceBalance(d, inv);
        if (a.amount > bal) fail(`Affectation supérieure au solde de ${inv.code} (${bal}).`);
      }
      if (a.receivableId) {
        const r = must(d.openingReceivables.find((x) => x.id === a.receivableId));
        const rest = r.amount - receivablePaid(d, r.id);
        if (a.amount > rest) fail(`Affectation supérieure au reste dû de ${r.code} (${rest}).`);
      }
    }
    const id = uid("pay");
    const code = nextCode(d, "payment", "DEMO-ENC");
    d.payments.unshift({ ...input, id, code, date: today(ctx), userId: ctx.user.id });
    const over = input.amount - allocated;
    audit(d, ctx, { module: "Finances", action: "Encaissement simulé", target: code, newValue: `${input.amount} (${input.method})${over > 0 ? ` — non affecté : ${over}` : ""}` });
    return {
      message: over > 0 ? `Encaissement ${code} enregistré. ${over} F non affecté(s) (acompte / trop-perçu au crédit du client).` : `Encaissement ${code} enregistré (simulation).`,
      data: id,
    };
  });

/** Affecte un acompte / trop-perçu existant à une facture. */
export const allocatePayment: Service<{ paymentId: string; invoiceId: string; amount: number }> = (db, ctx, input) =>
  produce(db, (d) => {
    const p = must(d.payments.find((x) => x.id === input.paymentId));
    const inv = must(d.invoices.find((x) => x.id === input.invoiceId));
    positive(input.amount, "Le montant");
    if (inv.clientId !== p.clientId) fail("Client différent.");
    if (!isActiveInvoice(inv) || inv.kind !== "facture") fail("Facture non validée.");
    if (input.amount > paymentUnallocated(p)) fail("Montant supérieur au disponible non affecté.");
    if (input.amount > invoiceBalance(d, inv)) fail("Montant supérieur au solde de la facture.");
    p.allocations.push({ invoiceId: inv.id, amount: input.amount });
    audit(d, ctx, { module: "Finances", action: "Affectation d'acompte", target: `${p.code} → ${inv.code}`, newValue: String(input.amount) });
    return { message: "Acompte affecté à la facture." };
  });

