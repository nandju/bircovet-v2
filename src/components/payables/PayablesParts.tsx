"use client";

import AppModal from "@/components/common/AppModal";
import { CheckField, FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { Link } from "@/i18n/navigation";
import { accountBalance } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { billState, dueFromTerms, soldQty, type BillState } from "@/lib/payables";
import { createBill, payBill, setPayAsSold, type BillInput } from "@/lib/services/payablesService";
import type { PaymentMethod, SupplierBill } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

export const KIND_LABEL: Record<SupplierBill["kind"], string> = { achat_stock: "Achat de stock", prestation: "Prestation", depot_vente: "Dépôt-vente" };

export function dueChip(s: BillState) {
  if (s.bill.status === "soldee") return { text: "Soldée", cls: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" };
  if (s.bill.kind === "depot_vente") return { text: "Payée au fil des ventes", cls: "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300" };
  if (s.overdue) return { text: `Échue depuis ${-s.daysToDue} j`, cls: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" };
  if (s.daysToDue <= 7) return { text: s.daysToDue === 0 ? "Échéance aujourd'hui" : `Dans ${s.daysToDue} j`, cls: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" };
  return { text: `Échéance ${formatDate(s.bill.dueDate)}`, cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" };
}

export function PayBillModal({ state, suggested, onClose }: { state: BillState | null; suggested?: number; onClose: () => void }) {
  const { db, run } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState({ amount: 0, accountId: "", method: "especes" as PaymentMethod, reference: "" });
  useEffect(() => {
    if (!state) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pré-remplissage à l'ouverture
    setV({ amount: Math.round(suggested ?? (state.bill.payAsSold && state.bill.kind !== "prestation" && !state.overdue ? Math.min(state.payableNow, state.remaining) || state.remaining : state.remaining)), accountId: db.accounts[0]?.id ?? "", method: "especes", reference: "" });
  }, [state, suggested, db.accounts]);
  if (!state) return null;
  const bal = v.accountId ? accountBalance(db, v.accountId) : 0;
  return (
    <AppModal
      isOpen
      onClose={onClose}
      title={`Payer ${state.supplier?.name ?? ""}`}
      description={`${state.bill.code} · ${state.bill.label} · reste ${formatXOF(state.remaining)}`}
      footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={() => run(payBill, { id: state.bill.id, ...v }).ok && onClose()}>Enregistrer le paiement</Button></>}
    >
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-theme-xs">
        <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5"><p className="text-gray-500">Reste dû</p><p className="font-semibold tabular-nums">{formatXOF(state.remaining)}</p></div>
        <div className="rounded-xl bg-tertiary-50 p-2 dark:bg-tertiary-500/10"><p className="text-gray-500">Couvert par les ventes</p><p className="font-semibold tabular-nums">{formatXOF(Math.min(state.payableNow, state.remaining))}</p></div>
        <div className={cn("rounded-xl p-2", bal < v.amount ? "bg-error-50 dark:bg-error-500/10" : "bg-success-50 dark:bg-success-500/10")}><p className="text-gray-500">Solde du compte</p><p className="font-semibold tabular-nums">{formatXOF(bal)}</p></div>
      </div>
      <FormGrid>
        <NumberField label="Montant" suffix="FCFA" value={v.amount} onChange={(x) => setV({ ...v, amount: x })} min={0} step={500} />
        <SelectField label="Payé depuis" value={v.accountId} onChange={(x) => setV({ ...v, accountId: x })} options={opts.accounts} />
        <SelectField label="Moyen" value={v.method} onChange={(x) => setV({ ...v, method: x as PaymentMethod })} options={optionsOf("paymentMethod")} />
        <TextField label="Référence (n° chèque, transaction…)" value={v.reference} onChange={(x) => setV({ ...v, reference: x })} />
      </FormGrid>
    </AppModal>
  );
}

export function BillFormModal({ isOpen, onClose, supplierId }: { isOpen: boolean; onClose: () => void; supplierId?: string }) {
  const { db, run, today } = useDemo();
  const blank = (): BillInput => ({ supplierId: supplierId ?? "", kind: "prestation", ref: "", label: "", date: today, dueDate: today, amount: NaN, payAsSold: false, notes: "" });
  const [v, setV] = useState<BillInput>(blank);
  useEffect(() => {
    if (!isOpen) return;
    const b = blank();
    const s = db.suppliers.find((x) => x.id === b.supplierId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialisation à l'ouverture
    setV({ ...b, kind: s?.kind === "fournisseur" ? "achat_stock" : "prestation", dueDate: dueFromTerms(today, s?.paymentTerms) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const pick = (id: string) => {
    const s = db.suppliers.find((x) => x.id === id);
    setV({ ...v, supplierId: id, kind: s?.kind === "prestataire" ? "prestation" : v.kind, dueDate: dueFromTerms(v.date, s?.paymentTerms) });
  };
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Nouvelle dette fournisseur / prestataire"
      description="Les achats de stock reçus créent leur dette automatiquement à la validation de la réception. Saisissez ici les prestations (électricité, maintenance, transport, laboratoire…) et les dépôts-vente."
      footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={() => run(createBill, { ...v, payAsSold: v.kind === "depot_vente" ? true : v.payAsSold }).ok && onClose()}>Enregistrer</Button></>}
    >
      <FormGrid>
        <SelectField label="Fournisseur / prestataire" required value={v.supplierId} onChange={pick} options={db.suppliers.filter((s) => s.status === "actif").map((s) => ({ value: s.id, label: `${s.name}${s.kind === "prestataire" ? " (prestataire)" : ""}` }))} />
        <SelectField label="Nature" value={v.kind} onChange={(x) => setV({ ...v, kind: x as SupplierBill["kind"] })} options={(Object.keys(KIND_LABEL) as SupplierBill["kind"][]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
        <TextField label="Objet" required value={v.label} onChange={(x) => setV({ ...v, label: x })} placeholder="Ex. : facture électricité octobre" className="sm:col-span-2" />
        <TextField label="N° facture du fournisseur" value={v.ref} onChange={(x) => setV({ ...v, ref: x })} />
        <NumberField label="Montant" required suffix="FCFA" value={v.amount} onChange={(x) => setV({ ...v, amount: x })} min={0} step={500} />
        <TextField label="Date de facture" type="date" value={v.date} onChange={(x) => setV({ ...v, date: x, dueDate: dueFromTerms(x, db.suppliers.find((s) => s.id === v.supplierId)?.paymentTerms) })} />
        <TextField label="Échéance" type="date" value={v.dueDate} onChange={(x) => setV({ ...v, dueDate: x })} />
        {v.kind === "achat_stock" && <CheckField label="Rembourser au fil des ventes des articles" checked={v.payAsSold} onChange={(x) => setV({ ...v, payAsSold: x })} />}
        <TextAreaField label="Note" value={v.notes ?? ""} onChange={(x) => setV({ ...v, notes: x })} rows={2} className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}

/** Une facture fournisseur : reste à payer, couverture par les ventes article par article. */
export function BillItem({ s, onPay, showSupplier = true }: { s: BillState; onPay: (s: BillState) => void; showSupplier?: boolean }) {
  const { db, run, can } = useDemo();
  const [open, setOpen] = useState(false);
  const chip = dueChip(s);
  const b = s.bill;
  return (
    <li className={cn("cliva-rise rounded-2xl border p-4", s.overdue ? "border-error-200 bg-error-25 dark:border-error-500/30 dark:bg-error-500/5" : "border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">{b.code} · {KIND_LABEL[b.kind]}{b.ref ? ` · réf. ${b.ref}` : ""} · {formatDate(b.date)}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {showSupplier && s.supplier && <Link href={`/achats/fournisseurs/${s.supplier.id}`} className="hover:underline">{s.supplier.name}</Link>}
            {showSupplier && " — "}{b.label}
          </p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", chip.cls)}>{chip.text}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1 text-sm">
        <span><span className="text-theme-xs text-gray-500">{b.kind === "depot_vente" ? "Dû (vendu)" : "Montant"} </span><strong className="tabular-nums">{formatXOF(b.kind === "depot_vente" ? s.owed : b.amount)}</strong>{b.kind === "depot_vente" && <span className="text-theme-xs text-gray-500"> sur {formatXOF(b.amount)} déposés</span>}</span>
        <span><span className="text-theme-xs text-gray-500">Payé </span><strong className="tabular-nums">{formatXOF(s.paid)}</strong></span>
        <span><span className="text-theme-xs text-gray-500">Reste </span><strong className={cn("tabular-nums", s.overdue && "text-error-600")}>{formatXOF(s.remaining)}</strong></span>
      </div>
      {b.lines.length > 0 && (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-linear-to-r from-tertiary-600 to-tertiary-400 transition-[width] duration-700" style={{ width: `${s.coveredPct}%` }} />
            </div>
            <span className="text-theme-xs text-gray-600 tabular-nums dark:text-gray-400">{s.coveredPct} % vendu · {formatXOF(s.covered)}</span>
          </div>
          {s.payableNow > 0 && s.remaining > 0 && b.payAsSold && <p className="mt-1 text-theme-xs font-medium text-tertiary-700 dark:text-tertiary-300">Les ventes permettent de payer {formatXOF(Math.min(s.payableNow, s.remaining))} maintenant.</p>}
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 dark:hover:text-white">{open ? "Masquer le détail" : `Détail des ${b.lines.length} article(s)`}</button>
          {open && (
            <table className="mt-2 w-full text-theme-xs">
              <thead><tr className="text-gray-500"><th className="text-start font-medium">Article</th><th className="text-end font-medium">Acheté</th><th className="text-end font-medium">Vendu</th><th className="text-end font-medium">Couvert</th></tr></thead>
              <tbody>
                {b.lines.map((l) => {
                  const sold = Math.min(l.qty, soldQty(db, b, l.productId));
                  return (
                    <tr key={l.productId} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-1">{db.products.find((p) => p.id === l.productId)?.name}</td>
                      <td className="py-1 text-end tabular-nums">{l.qty}</td>
                      <td className="py-1 text-end tabular-nums">{sold}</td>
                      <td className="py-1 text-end tabular-nums">{formatXOF(sold * l.unitCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
      {b.status === "ouverte" && (can("finances", "create") || can("achats", "update")) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="xs" onClick={() => onPay(s)} disabled={s.remaining <= 0 && b.kind !== "depot_vente"}>Payer</Button>
          {b.kind === "achat_stock" && (
            <label className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={b.payAsSold} onChange={(e) => run(setPayAsSold, { id: b.id, on: e.target.checked }, { silent: true })} className="accent-tertiary-500" />
              Rembourser au fil des ventes
            </label>
          )}
          {b.payments.length > 0 && <span className="text-[11px] text-gray-500">{b.payments.length} paiement(s), dernier le {formatDate(b.payments[b.payments.length - 1].date)}</span>}
        </div>
      )}
    </li>
  );
}

export const stateOf = (db: Parameters<typeof billState>[0], b: SupplierBill, today: string) => billState(db, b, today);
