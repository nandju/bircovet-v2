/**
 * Schéma v14 : dettes fournisseurs et prestataires (factures, échéances, paiements, dépôt-vente).
 */
import { dueFromTerms } from "./payables";
import { addDay } from "./treatments";
import type { DemoDB, Supplier, SupplierBill } from "./types";

export function migrateToV14(db: DemoDB, nowLocal: string): DemoDB {
  const today = nowLocal.slice(0, 10);
  if (db.bills) return { ...db, schemaVersion: 14 };
  const dg = db.users.find((u) => u.roleId === "dg")?.id ?? db.users[0].id;
  const bank = db.accounts.find((a) => a.type === "banque")?.id ?? db.accounts[0].id;
  const suppliers: Supplier[] = db.suppliers.map((s) => ({ ...s, kind: s.kind ?? "fournisseur" }));
  const prest: [string, string, string, string][] = [
    ["sup-p1", "Énergie Services (fictif)", "Électricité", "15 jours"],
    ["sup-p2", "Eau Potable Lagune (fictif)", "Eau", "15 jours"],
    ["sup-p3", "FroidTech Maintenance (fictif)", "Maintenance (froid, matériel)", "30 jours"],
    ["sup-p4", "Transit Express (fictif)", "Transport et livraison", "Comptant"],
    ["sup-p5", "Laboratoire d'analyses vétérinaires (fictif)", "Analyses", "30 jours"],
  ];
  prest.forEach(([id, name, category, paymentTerms], i) => {
    if (!suppliers.some((s) => s.id === id)) suppliers.push({ id, code: `PRE-${String(i + 1).padStart(3, "0")}`, name, contactName: "Service client (fictif)", phone: `27 22 40 00 ${String(i + 10)}`, email: "", address: "Abidjan (fictif)", category, paymentTerms, status: "actif", kind: "prestataire" });
  });
  const bills: SupplierBill[] = [];
  let n = 0;
  const code = () => `DET-${String(++n).padStart(4, "0")}`;
  const pay = (amount: number, date: string, reference = "") => ({ id: `bpay-${n}-${date}`, date: `${date}T10:00:00`, amount, accountId: bank, method: "virement" as const, reference, byId: dg });
  const termsOf = (id: string) => suppliers.find((s) => s.id === id)?.paymentTerms;

  // Achats de stock : réceptions validées.
  for (const r of db.receptions.filter((x) => x.status === "validee")) {
    const lines = r.lines.filter((l) => l.qtyReceived > 0 && l.check?.status !== "refuse").map((l) => ({ productId: l.productId, qty: l.qtyReceived, unitCost: l.unitCost }));
    const amount = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
    if (amount) bills.push({ id: `bill-${r.id}`, code: code(), supplierId: r.supplierId, kind: "achat_stock", ref: r.deliveryNoteRef, label: `Réception ${r.code}`, date: r.date, dueDate: dueFromTerms(r.date, termsOf(r.supplierId)), amount, receptionId: r.id, lines, payAsSold: true, payments: [], status: "ouverte", createdAt: `${r.date}T12:00:00`, createdById: dg });
  }
  // Achats antérieurs : lots en stock des fournisseurs principaux (remboursement au fil des ventes).
  const plan: [string, number, number][] = [["sup-1", 0.4, 0], ["sup-3", 0, 0], ["sup-2", 0.2, 0], ["sup-4", 0, 0]];
  for (const [sid, paidShare] of plan) {
    const lots = db.lots.filter((l) => l.supplierId === sid && !l.receptionId && l.receivedAt >= addDay(today, -150));
    if (!lots.length) continue;
    const date = lots.map((l) => l.receivedAt).sort()[0];
    const by = new Map<string, { qty: number; unitCost: number }>();
    for (const l of lots) {
      const e = by.get(l.productId) ?? { qty: 0, unitCost: l.unitCost };
      e.qty += l.qtyReceived;
      by.set(l.productId, e);
    }
    const lines = [...by.entries()].map(([productId, e]) => ({ productId, qty: e.qty, unitCost: e.unitCost }));
    const amount = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
    if (!amount) continue;
    const id = code();
    bills.push({ id: `bill-hist-${sid}`, code: id, supplierId: sid, kind: "achat_stock", ref: `FAC-${sid.toUpperCase()}-${date.slice(5, 7)}`, label: `Achats de stock (${lines.length} article(s))`, date, dueDate: dueFromTerms(date, termsOf(sid)), amount, lines, payAsSold: true, payments: paidShare ? [pay(Math.round((amount * paidShare) / 1000) * 1000, addDay(date, 10), "VIR-ACOMPTE")] : [], status: "ouverte", createdAt: `${date}T12:00:00`, createdById: dg });
  }
  // Dépôt-vente : aliments payés au fur et à mesure des ventes.
  const consLots = db.lots.filter((l) => l.supplierId === "sup-5");
  if (consLots.length) {
    const date = consLots.map((l) => l.receivedAt).sort()[0];
    const lines = consLots.map((l) => ({ productId: l.productId, qty: l.qtyReceived, unitCost: l.unitCost }));
    bills.push({ id: "bill-depot-sup-5", code: code(), supplierId: "sup-5", kind: "depot_vente", ref: "DEPOT-ALIM-01", label: "Dépôt-vente aliments", date, dueDate: addDay(today, 30), amount: lines.reduce((s, l) => s + l.qty * l.unitCost, 0), lines, payAsSold: true, payments: [], status: "ouverte", createdAt: `${date}T12:00:00`, createdById: dg, notes: "Le fournisseur est payé chaque fin de mois sur les quantités vendues." });
  }
  // Prestations.
  const pre: [string, string, number, string, number, string][] = [
    ["sup-p1", "Électricité — octobre", 85000, addDay(today, -11), 0, "CIE-10"],
    ["sup-p2", "Eau — octobre", 18000, addDay(today, -21), 0, "EAU-10"],
    ["sup-p3", "Maintenance du réfrigérateur à vaccins", 120000, addDay(today, -42), 40000, "MT-0921"],
    ["sup-p4", "Livraison commande vaccins", 25000, addDay(today, -9), 25000, "TR-221"],
    ["sup-p5", "Analyses (coproscopies, hémogrammes) — octobre", 60000, addDay(today, -6), 0, "LAB-1026"],
  ];
  for (const [sid, label, amount, date, paid, ref] of pre) {
    const id = code();
    bills.push({ id: `bill-${sid}-${date}`, code: id, supplierId: sid, kind: "prestation", ref, label, date, dueDate: dueFromTerms(date, termsOf(sid)), amount, lines: [], payAsSold: false, payments: paid ? [pay(paid, addDay(date, 5), "VIR")] : [], status: paid >= amount ? "soldee" : "ouverte", createdAt: `${date}T12:00:00`, createdById: dg });
  }
  return { ...db, schemaVersion: 14, suppliers, bills, counters: { ...db.counters, bill: Math.max(db.counters.bill ?? 0, n) } };
}
