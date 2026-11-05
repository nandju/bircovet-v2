import { lineTotal } from "../calc";
import { uid } from "../format";
import type { CashBox, CashBoxEntry, DemoDB } from "../types";
import { audit, fail, must, nextCode, produce, requireRole, type Service } from "./core";

const ROLES = ["dg", "accueil", "comptable"] as const;

/** Où est déjà affecté un encaissement ou une ligne ? */
export function boxOf(db: DemoDB, ref: { paymentId?: string; lineId?: string }) {
  return (db.cashBoxes ?? []).find((b) => b.entries.some((e) => (ref.paymentId && e.paymentId === ref.paymentId) || (ref.lineId && e.lineId === ref.lineId)));
}

export const saveCashBox: Service<{ id?: string; name: string; description?: string; color: string; target?: number; accountId?: string; active: boolean }, string> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, ["dg"], "création des caisses de suivi");
    if (!input.name.trim()) fail("Nom de la caisse requis.");
    d.cashBoxes = d.cashBoxes ?? [];
    if (d.cashBoxes.some((b) => b.id !== input.id && b.name.trim().toLowerCase() === input.name.trim().toLowerCase())) fail("Une caisse porte déjà ce nom.");
    const clean = { ...input, name: input.name.trim(), description: input.description?.trim() || undefined, target: input.target && input.target > 0 ? input.target : undefined, accountId: input.accountId || undefined };
    if (input.id) {
      const b = must(d.cashBoxes.find((x) => x.id === input.id));
      Object.assign(b, clean);
      return { message: "Caisse mise à jour.", data: b.id };
    }
    const id = uid("box");
    d.cashBoxes.push({ ...clean, id, code: nextCode(d, "box", "CS", 3), createdAt: ctx.now.slice(0, 10), entries: [] });
    return { message: `Caisse « ${clean.name} » créée.`, data: id };
  });

/** Affecte des encaissements et/ou des lignes de facture (prestations) à une caisse. */
export const assignToCashBox: Service<{ boxId: string; paymentIds?: string[]; lines?: { invoiceId: string; lineId: string }[]; move?: boolean }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...ROLES], "affectation aux caisses");
    const box = must((d.cashBoxes ?? []).find((b) => b.id === input.boxId), "Caisse introuvable.");
    if (!box.active) fail("Cette caisse est fermée.");
    let n = 0;
    const detach = (match: (e: CashBoxEntry) => boolean) => {
      for (const b of d.cashBoxes ?? []) b.entries = b.entries.filter((e) => !match(e));
    };
    for (const pid of input.paymentIds ?? []) {
      const p = must(d.payments.find((x) => x.id === pid), "Encaissement introuvable.");
      const other = boxOf(d, { paymentId: pid });
      if (other && other.id !== box.id && !input.move) fail(`${p.code} est déjà dans la caisse « ${other.name} ».`);
      if (other?.id === box.id) continue;
      detach((e) => e.paymentId === pid);
      box.entries.push({ id: uid("bxe"), kind: "encaissement", paymentId: pid, label: `${p.code}${p.note ? ` · ${p.note}` : ""}`, amount: p.amount, date: p.date.slice(0, 10), byId: ctx.user.id });
      n++;
    }
    for (const { invoiceId, lineId } of input.lines ?? []) {
      const inv = must(d.invoices.find((x) => x.id === invoiceId), "Facture introuvable.");
      const l = must(inv.lines.find((x) => x.id === lineId), "Ligne introuvable.");
      const other = boxOf(d, { lineId });
      if (other && other.id !== box.id && !input.move) fail(`« ${l.label} » (${inv.code}) est déjà dans la caisse « ${other.name} ».`);
      if (other?.id === box.id) continue;
      detach((e) => e.lineId === lineId);
      box.entries.push({ id: uid("bxe"), kind: "prestation", invoiceId, lineId, label: `${l.label} · ${inv.code}`, amount: lineTotal(l), date: inv.date.slice(0, 10), byId: ctx.user.id });
      n++;
    }
    if (!n) fail("Rien de nouveau à affecter.");
    audit(d, ctx, { module: "Finances", action: "Affectation caisse de suivi", target: box.name, newValue: `${n} élément(s)` });
    return { message: `${n} élément(s) affecté(s) à « ${box.name} ».` };
  });

/** Entrée saisie à la main (don, apport, subvention…) : suivi uniquement, n'affecte pas les soldes des comptes. */
export const addCashBoxEntry: Service<{ boxId: string; label: string; amount: number; date: string }> = (db, ctx, input) =>
  produce(db, (d) => {
    requireRole(ctx, [...ROLES], "entrée de caisse");
    const box = must((d.cashBoxes ?? []).find((b) => b.id === input.boxId));
    if (!input.label.trim()) fail("Libellé requis.");
    if (!(input.amount > 0)) fail("Montant requis.");
    box.entries.push({ id: uid("bxe"), kind: "entree", label: input.label.trim(), amount: input.amount, date: input.date, byId: ctx.user.id });
    return { message: "Entrée ajoutée." };
  });

export const removeCashBoxEntry: Service<{ boxId: string; entryId: string }> = (db, ctx, { boxId, entryId }) =>
  produce(db, (d) => {
    requireRole(ctx, [...ROLES], "affectation aux caisses");
    const box = must((d.cashBoxes ?? []).find((b) => b.id === boxId));
    box.entries = box.entries.filter((e) => e.id !== entryId);
    return { message: "Retiré de la caisse." };
  });

export const boxTotal = (b: CashBox, from?: string, to?: string) => b.entries.filter((e) => (!from || e.date >= from) && (!to || e.date <= to)).reduce((s, e) => s + e.amount, 0);
