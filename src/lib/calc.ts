/** Calculs métier purs (aucun effet de bord). */
import type { DemoDB, Invoice, InvoiceLine, InvoiceStatus, LotAllocation, StockLot } from "./types";

export const lineTotal = (l: Pick<InvoiceLine, "qty" | "unitPrice" | "discountPct">) =>
  Math.round(l.qty * l.unitPrice * (1 - (l.discountPct || 0) / 100));

export const docTotal = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + lineTotal(l), 0);

export const docGross = (lines: InvoiceLine[]) => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

export const maxDiscount = (lines: InvoiceLine[]) => lines.reduce((m, l) => Math.max(m, l.discountPct || 0), 0);

const ACTIVE_STATUSES: InvoiceStatus[] = ["validee", "partiellement_payee", "payee", "en_retard"];
export const isActiveInvoice = (inv: Invoice) => ACTIVE_STATUSES.includes(inv.status);

export function invoicePaid(db: DemoDB, invoiceId: string): number {
  let s = 0;
  for (const p of db.payments) for (const a of p.allocations) if (a.invoiceId === invoiceId) s += a.amount;
  return s;
}

export function invoiceCredited(db: DemoDB, invoiceId: string): number {
  return db.invoices
    .filter((i) => i.kind === "avoir" && i.originalInvoiceId === invoiceId && isActiveInvoice(i))
    .reduce((s, i) => s + docTotal(i.lines), 0);
}

export function invoiceBalance(db: DemoDB, inv: Invoice): number {
  if (inv.kind === "avoir") return 0;
  return docTotal(inv.lines) - invoicePaid(db, inv.id) - invoiceCredited(db, inv.id);
}

/** Recalcule le statut de paiement d'une facture validée. */
export function deriveInvoiceStatus(db: DemoDB, inv: Invoice, today: string): InvoiceStatus {
  if (!isActiveInvoice(inv)) return inv.status;
  if (inv.kind === "avoir") return "validee";
  const balance = invoiceBalance(db, inv);
  const paid = invoicePaid(db, inv.id);
  if (balance <= 0) return "payee";
  if (inv.dueDate < today) return "en_retard";
  if (paid > 0) return "partiellement_payee";
  return "validee";
}

export function receivablePaid(db: DemoDB, receivableId: string): number {
  let s = 0;
  for (const p of db.payments) for (const a of p.allocations) if (a.receivableId === receivableId) s += a.amount;
  return s;
}

export function paymentUnallocated(p: { amount: number; allocations: { amount: number }[] }): number {
  return p.amount - p.allocations.reduce((s, a) => s + a.amount, 0);
}

export function clientOutstanding(db: DemoDB, clientId: string): number {
  const inv = db.invoices
    .filter((i) => i.clientId === clientId && i.kind === "facture" && isActiveInvoice(i))
    .reduce((s, i) => s + Math.max(0, invoiceBalance(db, i)), 0);
  const old = db.openingReceivables
    .filter((r) => r.clientId === clientId)
    .reduce((s, r) => s + Math.max(0, r.amount - receivablePaid(db, r.id)), 0);
  return inv + old;
}

export function clientCreditBalance(db: DemoDB, clientId: string): number {
  return db.payments.filter((p) => p.clientId === clientId).reduce((s, p) => s + paymentUnallocated(p), 0);
}

/* ---------------- Comptes ---------------- */

export function accountBalance(db: DemoDB, accountId: string): number {
  const acc = db.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  let s = acc.openingBalance;
  for (const p of db.payments) if (p.accountId === accountId) s += p.amount;
  for (const e of db.expenses) if (e.accountId === accountId && e.status === "approuvee") s -= e.amount;
  for (const t of db.accountTransfers) {
    if (t.fromAccountId === accountId) s -= t.amount + t.fees;
    if (t.toAccountId === accountId) s += t.amount;
  }
  return s;
}

/* ---------------- Stock ---------------- */

export function lotUsable(lot: StockLot, today: string): boolean {
  return lot.status === "disponible" && lot.expiryDate >= today && lot.qtyAvailable > 0;
}

export function lotBlockReason(lot: StockLot, today: string): string | null {
  if (lot.status === "quarantaine") return "Lot en quarantaine : délivrance bloquée.";
  if (lot.status === "perime" || lot.expiryDate < today) return "Lot périmé : délivrance bloquée.";
  if (lot.status === "reserve") return "Lot réservé.";
  if (lot.qtyAvailable <= 0) return "Lot épuisé.";
  return null;
}

export function productStock(db: DemoDB, productId: string, establishmentId?: string, today?: string): number {
  return db.lots
    .filter(
      (l) =>
        l.productId === productId &&
        (!establishmentId || l.establishmentId === establishmentId) &&
        (today ? lotUsable(l, today) : l.status !== "perime"),
    )
    .reduce((s, l) => s + l.qtyAvailable, 0);
}

/** Sélection FEFO : lots utilisables, péremption la plus proche en premier. */
export function pickLotsFEFO(
  db: DemoDB,
  productId: string,
  establishmentId: string,
  qty: number,
  today: string,
): { ok: true; allocations: LotAllocation[] } | { ok: false; error: string } {
  const lots = db.lots
    .filter((l) => l.productId === productId && l.establishmentId === establishmentId && lotUsable(l, today))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const available = lots.reduce((s, l) => s + l.qtyAvailable, 0);
  if (available < qty)
    return {
      ok: false,
      error: `Stock utilisable insuffisant (${available} disponible(s), ${qty} demandé(s)). Les lots périmés ou en quarantaine sont exclus.`,
    };
  const allocations: LotAllocation[] = [];
  let rest = qty;
  for (const l of lots) {
    if (rest <= 0) break;
    const take = Math.min(rest, l.qtyAvailable);
    allocations.push({ lotId: l.id, qty: take });
    rest -= take;
  }
  return { ok: true, allocations };
}

export function isLowStock(db: DemoDB, productId: string, establishmentId: string | undefined, today: string): boolean {
  const p = db.products.find((x) => x.id === productId);
  if (!p || p.status !== "actif") return false;
  return productStock(db, productId, establishmentId, today) <= p.alertThreshold;
}

/* ---------------- Lookups ---------------- */

export const byId = <T extends { id: string }>(list: T[], id: string | undefined): T | undefined =>
  id ? list.find((x) => x.id === id) : undefined;

export const userName = (db: DemoDB, id?: string) => byId(db.users, id)?.name ?? "—";
export const clientName = (db: DemoDB, id?: string) => byId(db.clients, id)?.name ?? "—";
export const patientName = (db: DemoDB, id?: string) => byId(db.patients, id)?.name ?? "—";
export const productName = (db: DemoDB, id?: string) => byId(db.products, id)?.name ?? "—";
export const establishmentName = (db: DemoDB, id?: string) => byId(db.establishments, id)?.name ?? "—";
export const supplierName = (db: DemoDB, id?: string) => byId(db.suppliers, id)?.name ?? "—";
export const accountName = (db: DemoDB, id?: string) => byId(db.accounts, id)?.name ?? "—";
export const lotRef = (db: DemoDB, id?: string) => byId(db.lots, id)?.ref ?? "—";
