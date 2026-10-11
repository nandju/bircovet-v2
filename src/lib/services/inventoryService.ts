import { lotBlockReason } from "../calc";
import { uid } from "../format";
import type { ActionCtx, DemoDB, EntityRef, LotStatus, MovementType, Product, StockCorrection } from "../types";
import { audit, fail, must, nextCode, notify, positive, produce, requireOnline, requireRole, today, type Service } from "./core";

/**
 * Applique un mouvement de stock. Garanties :
 *  - idempotence via opKey (une même opération ne diminue jamais deux fois le stock) ;
 *  - aucune quantité disponible négative ;
 *  - sorties de délivrance/administration bloquées sur lot périmé / en quarantaine.
 */
export function applyMovement(
  d: DemoDB,
  ctx: ActionCtx,
  m: { lotId: string; type: MovementType; qty: number; ref?: EntityRef; note: string; opKey: string },
): string {
  const existing = d.movements.find((x) => x.opKey === m.opKey);
  if (existing) return existing.id;
  const lot = must(d.lots.find((l) => l.id === m.lotId), "Lot introuvable.");
  if (m.qty < 0 && (m.type === "delivrance" || m.type === "administration" || m.type === "mission_sortie")) {
    const reason = lotBlockReason(lot, today(ctx));
    if (reason && lot.qtyAvailable > 0) fail(`${lot.ref} — ${reason}`);
  }
  if (lot.qtyAvailable + m.qty < 0) fail(`Quantité insuffisante sur le lot ${lot.ref} (disponible : ${lot.qtyAvailable}). Un stock négatif est interdit.`);
  lot.qtyAvailable += m.qty;
  const id = uid("mv");
  d.movements.unshift({ id, date: ctx.now, productId: lot.productId, lotId: lot.id, establishmentId: lot.establishmentId, type: m.type, qty: m.qty, userId: ctx.user.id, ref: m.ref, note: m.note, opKey: m.opKey });
  const p = d.products.find((x) => x.id === lot.productId);
  if (p && m.qty < 0 && d.settings.notifyLowStock) {
    const stock = d.lots.filter((l) => l.productId === p.id && l.status === "disponible").reduce((s, l) => s + l.qtyAvailable, 0);
    if (stock <= p.alertThreshold && stock - m.qty > p.alertThreshold)
      notify(d, ctx, { title: "Stock faible", body: `${p.name} est passé sous le seuil d'alerte (${stock}).`, level: "alerte", link: `/stock/articles/${p.id}` });
  }
  return id;
}

export type ProductInput = Omit<Product, "id" | "code">;

export const createProduct: Service<ProductInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.name.trim()) fail("Nom requis.");
    if (!(input.conversion > 0)) fail("Conversion d'unités invalide.");
    if (input.salePrice < 0 || input.purchasePrice < 0) fail("Prix invalides.");
    const id = uid("prd");
    const prefix = { medicament: "MED", vaccin: "VAC", antiparasitaire: "APR", consommable: "CON", aliment: "ALI", materiel: "MAT" }[input.category];
    const max = d.products.filter((p) => p.code.startsWith(`${prefix}-`)).reduce((m, p) => Math.max(m, Number(p.code.split("-")[1]) || 0), 0);
    const finalCode = `${prefix}-${String(max + 1).padStart(3, "0")}`;
    d.products.unshift({ ...input, id, code: finalCode });
    audit(d, ctx, { module: "Stock", action: "Création d'article", target: `${finalCode} — ${input.name}` });
    return { message: `Article ${finalCode} créé.`, data: id };
  });

export const updateProduct: Service<{ id: string; patch: Partial<ProductInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    const p = must(d.products.find((x) => x.id === id));
    const before = `${p.salePrice} / seuil ${p.alertThreshold}`;
    Object.assign(p, patch);
    audit(d, ctx, { module: "Stock", action: "Modification d'article", target: p.code, oldValue: before, newValue: `${p.salePrice} / seuil ${p.alertThreshold}` });
    return { message: "Article mis à jour." };
  });

export const setLotStatus: Service<{ lotId: string; status: LotStatus; reason: string }> = (db, ctx, { lotId, status, reason }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "vet", "assistant", "accueil"], "changement de statut de lot");
    const lot = must(d.lots.find((l) => l.id === lotId));
    if (!reason.trim()) fail("Motif requis.");
    if (status === "disponible" && lot.expiryDate < today(ctx)) fail("Un lot périmé ne peut pas être remis en disponibilité.");
    const old = lot.status;
    lot.status = status;
    audit(d, ctx, { module: "Stock", action: "Statut de lot", target: lot.ref, oldValue: old, newValue: status, reason });
    return { message: "Statut du lot mis à jour." };
  });

/** Proposition de correction / perte / retour : validée ensuite par le DG. */
export const proposeCorrection: Service<{ lotId: string; qtyDelta: number; reason: string; kind: StockCorrection["kind"] }> = (db, ctx, input) =>
  produce(db, (d) => {
    const lot = must(d.lots.find((l) => l.id === input.lotId));
    if (!input.reason.trim()) fail("Motif requis.");
    if (!input.qtyDelta) fail("Écart nul.");
    if ((input.kind === "perte" || input.kind === "retour_fournisseur") && input.qtyDelta > 0) fail("Une perte ou un retour est une sortie (quantité négative).");
    if (lot.qtyAvailable + input.qtyDelta < 0) fail("La correction rendrait le stock négatif.");
    d.corrections.unshift({ id: uid("cor"), date: ctx.now, lotId: lot.id, productId: lot.productId, qtyDelta: input.qtyDelta, reason: input.reason, kind: input.kind, requestedById: ctx.user.id, status: "proposee" });
    notify(d, ctx, { title: "Correction de stock à valider", body: `${lot.ref} : ${input.qtyDelta > 0 ? "+" : ""}${input.qtyDelta} (${input.reason})`, level: "info", link: "/stock/corrections" });
    audit(d, ctx, { module: "Stock", action: "Proposition de correction", target: lot.ref, newValue: String(input.qtyDelta), reason: input.reason });
    return { message: "Correction proposée — validation DG requise." };
  });

export const decideCorrection: Service<{ id: string; approve: boolean; note?: string }> = (db, ctx, { id, approve, note }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "validation de correction de stock");
    requireOnline(ctx, "Ajustement de stock sensible");
    const c = must(d.corrections.find((x) => x.id === id));
    if (c.status !== "proposee") fail("Cette correction a déjà été traitée.");
    if (approve) {
      const type: MovementType = c.kind === "inventaire" ? "inventaire" : c.kind === "perte" ? "perte" : c.kind === "retour_fournisseur" ? "retour_fournisseur" : "correction";
      applyMovement(d, ctx, { lotId: c.lotId, type, qty: c.qtyDelta, ref: { kind: "correction", id: c.id }, note: c.reason, opKey: `cor-${c.id}` });
    }
    c.status = approve ? "validee" : "rejetee";
    c.decidedById = ctx.user.id;
    c.decidedAt = ctx.now;
    audit(d, ctx, { module: "Stock", action: "Décision de correction", target: d.lots.find((l) => l.id === c.lotId)?.ref ?? c.lotId, newValue: String(c.qtyDelta), reason: note || c.reason, decision: approve ? "Validée" : "Rejetée" });
    return { message: approve ? "Correction validée et appliquée au stock." : "Correction rejetée." };
  });

export const transferStock: Service<{ lotId: string; toEstablishmentId: string; qty: number; location: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    positive(input.qty, "La quantité");
    const lot = must(d.lots.find((l) => l.id === input.lotId));
    if (lot.establishmentId === input.toEstablishmentId) fail("Établissement de destination identique.");
    if (lot.status === "quarantaine" || lot.status === "perime" || lot.expiryDate < today(ctx)) fail("Lot non transférable (périmé ou en quarantaine).");
    const code = nextCode(d, "stockTransfer", "TRS");
    const tid = uid("trs");
    applyMovement(d, ctx, { lotId: lot.id, type: "transfert_sortie", qty: -input.qty, ref: { kind: "transfert", id: tid }, note: `${code} vers ${input.toEstablishmentId}`, opKey: `${tid}-out` });
    let dest = d.lots.find((l) => l.ref === lot.ref && l.establishmentId === input.toEstablishmentId);
    if (!dest) {
      dest = { ...lot, id: uid("lot"), establishmentId: input.toEstablishmentId, location: input.location, qtyReceived: 0, qtyAvailable: 0, receptionId: undefined };
      d.lots.push(dest);
    }
    applyMovement(d, ctx, { lotId: dest.id, type: "transfert_entree", qty: input.qty, ref: { kind: "transfert", id: tid }, note: `${code} depuis ${lot.establishmentId}`, opKey: `${tid}-in` });
    d.stockTransfers.unshift({ id: tid, code, date: ctx.now, fromEstablishmentId: lot.establishmentId, toEstablishmentId: input.toEstablishmentId, lotId: lot.id, qty: input.qty, userId: ctx.user.id, status: "effectue" });
    audit(d, ctx, { module: "Stock", action: "Transfert inter-établissements", target: `${code} — ${lot.ref}`, newValue: `${input.qty}` });
    return { message: `Transfert ${code} effectué.` };
  });

export const startInventory: Service<{ establishmentId: string }, string> = (db, ctx, { establishmentId }) =>
  produce(db, (d) => {
    if (d.inventories.some((i) => i.establishmentId === establishmentId && i.status !== "valide")) fail("Un inventaire est déjà en cours pour cet établissement.");
    const id = uid("inv");
    const code = nextCode(d, "inventory", "INV");
    d.inventories.unshift({
      id,
      code,
      date: ctx.now,
      establishmentId,
      authorId: ctx.user.id,
      status: "en_cours",
      lines: d.lots.filter((l) => l.establishmentId === establishmentId && (l.qtyAvailable > 0 || l.status !== "perime")).map((l) => ({ lotId: l.id, expected: l.qtyAvailable, counted: null })),
    });
    return { message: `Inventaire ${code} ouvert.`, data: id };
  });

export const setInventoryCount: Service<{ id: string; lotId: string; counted: number | null }> = (db, ctx, { id, lotId, counted }) =>
  produce(db, (d) => {
    const inv = must(d.inventories.find((x) => x.id === id));
    if (inv.status !== "en_cours") fail("Inventaire clos.");
    if (counted !== null && counted < 0) fail("Quantité comptée invalide.");
    const line = must(inv.lines.find((l) => l.lotId === lotId));
    line.counted = counted;
  });

export const proposeInventory: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    const inv = must(d.inventories.find((x) => x.id === id));
    if (inv.status !== "en_cours") fail("Inventaire déjà proposé.");
    if (inv.lines.some((l) => l.counted === null)) fail("Toutes les lignes doivent être comptées.");
    let n = 0;
    for (const l of inv.lines) {
      const delta = (l.counted ?? 0) - l.expected;
      if (delta !== 0) {
        n++;
        d.corrections.unshift({ id: uid("cor"), date: ctx.now, lotId: l.lotId, productId: d.lots.find((x) => x.id === l.lotId)!.productId, qtyDelta: delta, reason: `Écart d'inventaire ${inv.code}`, kind: "inventaire", requestedById: ctx.user.id, status: "proposee", inventoryId: inv.id });
      }
    }
    inv.status = "propose";
    audit(d, ctx, { module: "Stock", action: "Inventaire proposé", target: inv.code, newValue: `${n} écart(s)` });
    return { message: n ? `${n} écart(s) proposé(s) — validation DG requise.` : "Aucun écart constaté." };
  });

export const validateInventory: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "validation d'inventaire");
    requireOnline(ctx, "Ajustement de stock sensible");
    const inv = must(d.inventories.find((x) => x.id === id));
    if (inv.status !== "propose") fail("L'inventaire doit d'abord être proposé.");
    for (const c of d.corrections.filter((x) => x.inventoryId === id && x.status === "proposee")) {
      applyMovement(d, ctx, { lotId: c.lotId, type: "inventaire", qty: c.qtyDelta, ref: { kind: "inventaire", id }, note: c.reason, opKey: `cor-${c.id}` });
      c.status = "validee";
      c.decidedById = ctx.user.id;
      c.decidedAt = ctx.now;
    }
    inv.status = "valide";
    audit(d, ctx, { module: "Stock", action: "Validation d'inventaire", target: inv.code, decision: "Validé" });
    return { message: "Inventaire validé ; écarts appliqués au stock." };
  });
