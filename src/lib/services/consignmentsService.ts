import { uid } from "../format";
import type { ConsignmentStatus } from "../types";
import { audit, fail, must, nextCode, positive, produce, today, type Service } from "./core";

/**
 * Dépôt-vente : suivi des produits confiés à un client sans les assimiler
 * à une vente encaissée. Le dépôt n'est pas une sortie de stock comptabilisée
 * comme vente ; la situation reste distincte jusqu'au règlement ou au retour.
 */
export const createConsignment: Service<{ clientId: string; productId: string; qty: number; unitPrice: number; note: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    must(d.clients.find((c) => c.id === input.clientId), "Client requis.");
    const prod = must(d.products.find((p) => p.id === input.productId && p.status === "actif"), "Produit actif requis.");
    positive(input.qty, "La quantité");
    if (input.unitPrice < 0) fail("Prix unitaire invalide.");
    const id = uid("csg");
    const code = nextCode(d, "consignment", "DEP");
    d.consignments.unshift({
      id,
      code,
      clientId: input.clientId,
      productId: prod.id,
      qty: input.qty,
      unitPrice: input.unitPrice,
      date: today(ctx),
      status: "en_depot",
      note: input.note.trim(),
      history: [{ date: ctx.now, userId: ctx.user.id, action: "Dépôt enregistré" }],
    });
    audit(d, ctx, { module: "Stock", action: "Dépôt-vente enregistré", target: `${code} — ${prod.name}`, newValue: `${input.qty} × ${input.unitPrice}` });
    return { message: `Dépôt-vente ${code} enregistré — ce n'est pas encore une vente encaissée.`, data: id };
  });

const FLOW: Record<ConsignmentStatus, ConsignmentStatus[]> = {
  en_depot: ["en_tresorerie", "a_credit", "solde", "retourne"],
  en_tresorerie: ["a_credit", "solde", "retourne"],
  a_credit: ["solde", "retourne"],
  solde: [],
  retourne: [],
};

export const setConsignmentStatus: Service<{ id: string; status: ConsignmentStatus; note?: string }> = (db, ctx, { id, status, note }) =>
  produce(db, (d) => {
    const c = must(d.consignments.find((x) => x.id === id));
    if (!FLOW[c.status].includes(status)) fail("Transition de situation non autorisée.");
    c.status = status;
    c.history.push({ date: ctx.now, userId: ctx.user.id, action: `Situation : ${status}`, note: note?.trim() });
    audit(d, ctx, { module: "Stock", action: "Situation dépôt-vente", target: c.code, newValue: status });
    return { message: "Situation du dépôt mise à jour." };
  });
