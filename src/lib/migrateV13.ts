/**
 * Schéma v13 : activité de démonstration du jour et de la veille (ventes comptoir avec
 * sorties de stock FEFO, encaissements de consultations / missions), pour la recette du jour.
 */
import { docTotal, invoiceBalance, isActiveInvoice } from "./calc";
import { addDay } from "./treatments";
import type { DemoDB, Invoice, Payment, StockMovement } from "./types";

export function migrateToV13(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.invoices.some((i) => i.id.startsWith("inv-day"))) return { ...db, schemaVersion: 13 };
  const est = db.establishments[0]?.id;
  const cash = db.accounts.find((a) => a.type === "caisse" && a.establishmentId === est) ?? db.accounts[0];
  const mm = db.accounts.find((a) => a.type !== "caisse" && a.establishmentId === est) ?? cash;
  const seller = db.users.find((u) => u.roleId === "accueil")?.id ?? db.users[0].id;
  const buyers = db.clients.filter((c) => c.status === "actif" && !c.isWalkIn);
  const lots = db.lots.map((l) => ({ ...l }));
  const invoices = [...db.invoices];
  const payments = [...db.payments];
  const movements = [...db.movements];
  const counters = { ...db.counters };
  const products = db.products.filter((p) => p.status === "actif" && p.salePrice > 0 && ["medicament", "antiparasitaire", "vaccin", "aliment"].includes(p.category));
  const plan: [string, string, number, boolean][] = [
    [addDay(today, -1), "09:20", 0, true],
    [addDay(today, -1), "16:45", 1, true],
    [today, "08:40", 2, true],
    [today, "10:15", 3, false],
    [today, "11:50", 4, false],
    [today, "14:05", 5, false],
  ];
  const species = ["Volaille", "Chien", "Bovin", "Volaille", "Porcin", "Chat"];
  plan.forEach(([date, time, k, fne]) => {
    if (!products.length || !buyers.length) return;
    const lines: Invoice["lines"] = [];
    for (const [j, p] of [products[(k * 3 + 1) % products.length], ...(k % 2 ? [products[(k * 7 + 4) % products.length]] : [])].entries()) {
      const qty = 1 + ((k + j) % 3);
      const lot = lots.filter((l) => l.productId === p.id && l.establishmentId === est && l.status === "disponible" && l.qtyAvailable >= qty && l.expiryDate >= today).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
      if (!lot) continue;
      lot.qtyAvailable -= qty;
      const mv: StockMovement = { id: `mv-day${k}-${j}`, date: `${date}T${time}:00`, productId: p.id, lotId: lot.id, establishmentId: est, type: "delivrance", qty: -qty, userId: seller, ref: { kind: "facture", id: `inv-day${k}` }, note: "Vente comptoir (démo)", opKey: `seed-day${k}-${j}` };
      movements.unshift(mv);
      lines.push({ id: `il-day${k}-${j}`, label: p.brandName ?? p.name, kind: "produit", productId: p.id, qty, unitPrice: p.salePrice, discountPct: 0, source: { kind: "vente", id: `inv-day${k}`, label: "Comptoir" } });
    }
    if (!lines.length) return;
    const client = buyers[(k * 5) % buyers.length];
    counters.invoice = (counters.invoice ?? 0) + 1;
    const code = `${db.settings.invoicePrefix}-${String(counters.invoice).padStart(4, "0")}`;
    invoices.unshift({ id: `inv-day${k}`, code, kind: "facture", channel: "comptoir", clientId: client.id, payerName: client.name, establishmentId: est, date, dueDate: date, lines, status: "validee", authorId: seller, validatedById: seller, validatedAt: `${date}T${time}:00`, creditNoteIds: [], fiscalStatus: "a_transmettre_backend", notes: "Vente comptoir (démo)", saleInfo: { species: species[k], sellerId: seller }, ...(fne ? { fneNumber: `FNE-${date.replace(/-/g, "")}-${k + 1}`, fneStatus: "fne" as const } : {}) });
    counters.payment = (counters.payment ?? 0) + 1;
    const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    payments.unshift({ id: `pay-day${k}`, code: `DEMO-ENC-${String(counters.payment).padStart(4, "0")}`, date: `${date}T${time}:00`, clientId: client.id, amount: total, method: k % 2 ? "mobile_money" : "especes", accountId: k % 2 ? mm.id : cash.id, kind: "reglement", allocations: [{ invoiceId: `inv-day${k}`, amount: total }], reference: "", userId: seller, opKey: `seed-payday${k}`, note: "Vente comptoir (démo)" } as Payment);
  });
  // Encaissements d'actes : règlement de factures de consultation / mission encore dues.
  const tmp = { ...db, invoices, payments };
  const open = invoices.filter((i) => i.kind === "facture" && i.channel !== "comptoir" && isActiveInvoice(i) && invoiceBalance(tmp, i) > 0).slice(0, 3);
  open.forEach((inv, k) => {
    const amount = Math.min(invoiceBalance(tmp, inv), Math.max(5000, Math.round(docTotal(inv.lines) * 0.6)));
    const date = k === 2 ? addDay(today, -1) : today;
    counters.payment = (counters.payment ?? 0) + 1;
    payments.unshift({ id: `pay-dayact${k}`, code: `DEMO-ENC-${String(counters.payment).padStart(4, "0")}`, date: `${date}T${["09:30", "15:10", "17:20"][k]}:00`, clientId: inv.clientId, amount, method: "especes", accountId: cash.id, kind: "reglement", allocations: [{ invoiceId: inv.id, amount }], reference: "", userId: seller, opKey: `seed-payact${k}`, note: "Règlement (démo)" } as Payment);
  });
  return { ...db, schemaVersion: 13, lots, invoices, payments, movements, counters };
}
