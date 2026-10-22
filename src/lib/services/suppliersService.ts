import { uid } from "../format";
import type { DemoDB, PurchaseOrder, PurchaseOrderLine, ReceptionLine, Supplier } from "../types";
import { audit, fail, must, nextCode, notify, produce, requireRole, today, type Service } from "./core";
import { applyMovement } from "./inventoryService";

export type SupplierInput = Omit<Supplier, "id" | "code">;

export const createSupplier: Service<SupplierInput, string> = (db, ctx, input) =>
  produce(db, (d) => {
    if (!input.name.trim()) fail("Raison sociale requise.");
    const id = uid("sup");
    const code = nextCode(d, "supplier", "FRN", 3);
    d.suppliers.unshift({ ...input, id, code });
    audit(d, ctx, { module: "Achats", action: "Création fournisseur", target: `${code} — ${input.name}` });
    return { message: `Fournisseur ${code} créé.`, data: id };
  });

export const updateSupplier: Service<{ id: string; patch: Partial<SupplierInput> }> = (db, ctx, { id, patch }) =>
  produce(db, (d) => {
    Object.assign(must(d.suppliers.find((s) => s.id === id)), patch);
    return { message: "Fournisseur mis à jour." };
  });

function checkPOLines(lines: PurchaseOrderLine[]) {
  if (!lines.length) fail("Au moins une ligne est requise.");
  if (lines.some((l) => !l.productId || !(l.qtyOrdered > 0) || l.unitPrice < 0)) fail("Ligne de commande invalide.");
}

export const createPurchaseOrder: Service<{ supplierId: string; expectedDate: string; lines: PurchaseOrderLine[]; notes: string }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "assistant"], "commande d'achat");
    must(d.suppliers.find((s) => s.id === input.supplierId && s.status === "actif"), "Fournisseur actif requis.");
    checkPOLines(input.lines);
    const id = uid("po");
    const code = nextCode(d, "po", "BC");
    d.purchaseOrders.unshift({ id, code, supplierId: input.supplierId, establishmentId: ctx.establishmentId, date: today(ctx), expectedDate: input.expectedDate, lines: input.lines.map((l) => ({ ...l, id: l.id || uid("pol") })), status: "brouillon", authorId: ctx.user.id, notes: input.notes });
    audit(d, ctx, { module: "Achats", action: "Création de commande", target: code });
    return { message: `Commande ${code} créée en brouillon${ctx.user.roleId === "assistant" ? " — à valider par un responsable" : ""}.`, data: id };
  });

/** Commentaire mensuel de revue des commandes (aide aux prévisions). */
export const saveOrderReview: Service<{ month: string; comment: string }> = (db, ctx, { month, comment }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "assistant"], "revue des commandes");
    const r = d.orderReviews.find((x) => x.month === month);
    if (r) {
      r.comment = comment;
      r.userId = ctx.user.id;
      r.date = ctx.now;
    } else {
      d.orderReviews.push({ id: uid("orv"), month, comment, userId: ctx.user.id, date: ctx.now });
    }
    return { message: "Commentaire de revue mensuelle enregistré." };
  });

export const updatePurchaseOrder: Service<{ id: string; expectedDate: string; lines: PurchaseOrderLine[]; notes: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    const po = must(d.purchaseOrders.find((x) => x.id === input.id));
    if (po.status !== "brouillon") fail("Seule une commande brouillon est modifiable.");
    checkPOLines(input.lines);
    Object.assign(po, { expectedDate: input.expectedDate, lines: input.lines, notes: input.notes });
    return { message: "Commande enregistrée." };
  });

export const setPOStatus: Service<{ id: string; status: Extract<PurchaseOrder["status"], "envoyee" | "annulee" | "cloturee">; reason?: string }> = (db, ctx, { id, status, reason }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "gestion des commandes");
    const po = must(d.purchaseOrders.find((x) => x.id === id));
    if (status === "envoyee" && po.status !== "brouillon") fail("Seul un brouillon peut être envoyé.");
    if (status === "annulee" && !["brouillon", "envoyee"].includes(po.status)) fail("Commande déjà réceptionnée : annulation impossible, clôturez-la.");
    if (status === "cloturee" && !["partiellement_recue", "recue"].includes(po.status)) fail("Seule une commande réceptionnée peut être clôturée.");
    if (status !== "envoyee" && !reason?.trim()) fail("Motif requis.");
    po.status = status;
    audit(d, ctx, { module: "Achats", action: `Commande ${status}`, target: po.code, reason });
    return { message: status === "envoyee" ? "Commande marquée envoyée (simulation — aucun envoi réel au fournisseur)." : "Statut de la commande mis à jour." };
  });

export function receivedForLine(db: DemoDB, poLineId: string): number {
  return db.receptions.filter((r) => r.status === "validee").flatMap((r) => r.lines).filter((l) => l.poLineId === poLineId).reduce((s, l) => s + l.qtyReceived, 0);
}

/** Réception proposée : ne rend PAS le stock disponible avant validation. */
export const createReception: Service<{ poId?: string; supplierId: string; deliveryNoteRef: string; lines: ReceptionLine[]; source: "manuel" | "bli_edi" }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil", "assistant"], "réception");
    if (!input.lines.length) fail("Aucune ligne à réceptionner.");
    if (input.lines.every((l) => l.qtyReceived <= 0)) fail("Aucune quantité reçue saisie.");
    for (const l of input.lines) {
      if (l.qtyReceived < 0) fail("Quantité reçue invalide.");
      if (l.qtyReceived > 0 && (!l.lotRef.trim() || !l.expiryDate)) fail("Référence de lot et date de péremption obligatoires pour chaque ligne reçue.");
      if (l.qtyReceived > 0 && l.expiryDate <= today(ctx)) fail(`Le lot ${l.lotRef} est déjà périmé.`);
    }
    if (input.poId) {
      const po = must(d.purchaseOrders.find((p) => p.id === input.poId));
      if (!["envoyee", "partiellement_recue"].includes(po.status)) fail("La commande doit être envoyée pour être réceptionnée.");
    }
    const id = uid("rec");
    const code = nextCode(d, "reception", "REC");
    d.receptions.unshift({ id, code, poId: input.poId, supplierId: input.supplierId, establishmentId: ctx.establishmentId, date: today(ctx), source: input.source, deliveryNoteRef: input.deliveryNoteRef, status: "proposee", lines: input.lines.map((l) => ({ ...l, id: l.id || uid("rl") })), authorId: ctx.user.id });
    const gaps = input.lines.filter((l) => l.qtyReceived !== l.qtyOrdered).length;
    notify(d, ctx, { title: "Réception à valider", body: `${code}${gaps ? ` — ${gaps} écart(s) de quantité` : ""}`, level: gaps ? "alerte" : "info", link: "/achats/receptions" });
    audit(d, ctx, { module: "Achats", action: input.source === "bli_edi" ? "Import BLI/EDI simulé → réception proposée" : "Réception proposée", target: code, newValue: `${gaps} écart(s)` });
    return { message: `Réception ${code} proposée. Le stock vendable n'augmentera qu'après validation.`, data: id };
  });

export const validateReception: Service<{ id: string }> = (db, ctx, { id }) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg", "accueil"], "validation de réception");
    const rec = must(d.receptions.find((r) => r.id === id));
    if (rec.status !== "proposee") fail("Réception déjà traitée.");
    let total = 0;
    for (const l of rec.lines) {
      if (l.qtyReceived <= 0) continue;
      const prod = must(d.products.find((p) => p.id === l.productId));
      const est = d.establishments.find((e) => e.id === rec.establishmentId);
      const lotId = uid("lot");
      d.lots.push({ id: lotId, ref: l.lotRef, productId: l.productId, supplierId: rec.supplierId, establishmentId: rec.establishmentId, location: est?.locations[0] ?? "Réserve", receivedAt: today(ctx), expiryDate: l.expiryDate, qtyReceived: 0, qtyAvailable: 0, unitCost: l.unitCost, status: "disponible", receptionId: rec.id });
      applyMovement(d, ctx, { lotId, type: "reception", qty: l.qtyReceived, ref: { kind: "reception", id: rec.id }, note: `${rec.code} — ${prod.name}`, opKey: `rec-${rec.id}-${l.id}` });
      d.lots.find((x) => x.id === lotId)!.qtyReceived = l.qtyReceived;
      total += l.qtyReceived;
    }
    rec.status = "validee";
    rec.validatedById = ctx.user.id;
    rec.validatedAt = ctx.now;
    if (rec.poId) {
      const po = must(d.purchaseOrders.find((p) => p.id === rec.poId));
      const complete = po.lines.every((pl) => receivedForLine(d, pl.id) >= pl.qtyOrdered);
      po.status = complete ? "recue" : "partiellement_recue";
    }
    audit(d, ctx, { module: "Achats", action: "Validation de réception", target: rec.code, newValue: `${total} unité(s) entrée(s) en stock`, decision: `Validée par ${ctx.user.name}` });
    return { message: `Réception validée : ${total} unité(s) effectivement reçue(s) entrée(s) en stock.` };
  });

export const rejectReception: Service<{ id: string; reason: string }> = (db, ctx, { id, reason }) =>
  produce(db, (d) => {
    const rec = must(d.receptions.find((r) => r.id === id));
    if (rec.status !== "proposee") fail("Réception déjà traitée.");
    if (!reason.trim()) fail("Motif requis.");
    rec.status = "rejetee";
    audit(d, ctx, { module: "Achats", action: "Rejet de réception", target: rec.code, reason });
    return { message: "Réception rejetée — aucun mouvement de stock." };
  });

/**
 * Parse un fichier BLI/EDI d'exemple (format CSV simplifié) :
 * CODE_ARTICLE;QTE;LOT;PEREMPTION(AAAA-MM-JJ);PRIX_UNITAIRE
 */
export function parseBLI(db: DemoDB, text: string): { lines: ReceptionLine[]; errors: string[] } {
  const lines: ReceptionLine[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !/^code/i.test(l))
    .forEach((row, i) => {
      const [code, qty, lot, exp, price] = row.split(/[;,]/).map((x) => x?.trim());
      const prod = db.products.find((p) => p.code.toLowerCase() === (code ?? "").toLowerCase());
      if (!prod) return errors.push(`Ligne ${i + 1} : article « ${code} » inconnu.`);
      const q = Number(qty);
      if (!(q > 0)) return errors.push(`Ligne ${i + 1} : quantité invalide.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exp ?? "")) return errors.push(`Ligne ${i + 1} : date de péremption invalide.`);
      lines.push({ id: uid("rl"), productId: prod.id, qtyOrdered: q, qtyReceived: q, lotRef: lot || `BLI-${i + 1}`, expiryDate: exp!, unitCost: Number(price) || prod.purchasePrice });
    });
  return { lines, errors };
}
