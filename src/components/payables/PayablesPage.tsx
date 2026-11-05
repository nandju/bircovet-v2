"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { formatDate, formatXOF } from "@/lib/format";
import { billState, openBills, paymentPlan, payablesSummary, type BillState } from "@/lib/payables";
import { cn } from "@/utils";
import { useState } from "react";
import { BillFormModal, BillItem, PayBillModal } from "./PayablesParts";

export function PayablesKpis() {
  const { db, today } = useDemo();
  const s = payablesSummary(db, today);
  const items: { l: string; v: string; h: string; tone: string }[] = [
    { l: "Reste à payer", v: formatXOF(s.total), h: `${s.suppliers.length} fournisseur(s) / prestataire(s)`, tone: "cliva-glow cliva-grad-gestion text-white" },
    { l: "Échu, non payé", v: formatXOF(s.overdue), h: `${s.overdueCount} facture(s) en retard`, tone: s.overdue ? "border border-error-200 bg-error-25 dark:border-error-500/30 dark:bg-error-500/5" : "border border-gray-200/70 bg-white dark:border-gray-800 dark:bg-white/3" },
    { l: "À payer sous 7 jours", v: formatXOF(s.due7), h: `${formatXOF(s.due30)} sous 30 jours`, tone: "border border-gray-200/70 bg-white dark:border-gray-800 dark:bg-white/3" },
    { l: "Déjà couvert par les ventes", v: formatXOF(s.payableNow), h: "payable maintenant sans puiser dans la trésorerie", tone: "border border-tertiary-200 bg-tertiary-25 dark:border-tertiary-500/30 dark:bg-tertiary-500/5" },
    { l: "Trésorerie disponible", v: formatXOF(s.cash), h: `${formatXOF(s.afterDue)} après l'échu et les 7 j`, tone: s.afterDue < 0 ? "border border-error-200 bg-error-25 dark:border-error-500/30 dark:bg-error-500/5" : "border border-gray-200/70 bg-white dark:border-gray-800 dark:bg-white/3" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((x, i) => (
        <div key={x.l} className={cn("cliva-rise rounded-3xl p-4 shadow-cliva", x.tone, i === 0 && "col-span-2 md:col-span-1")}>
          <p className={cn("text-theme-xs", i === 0 ? "text-white/80" : "text-gray-500")}>{x.l}</p>
          <p className={cn("mt-1 text-xl font-semibold tracking-tight tabular-nums", i === 0 ? "text-white" : "text-gray-900 dark:text-white")}>{x.v}</p>
          <p className={cn("text-[11px]", i === 0 ? "text-white/75" : "text-gray-500")}>{x.h}</p>
        </div>
      ))}
    </div>
  );
}

export default function PayablesPage() {
  const { db, today, can } = useDemo();
  const [tab, setTab] = useState("plan");
  const [pay, setPay] = useState<{ s: BillState; amount?: number } | null>(null);
  const [create, setCreate] = useState(false);
  const sum = payablesSummary(db, today);
  const [budget, setBudget] = useState<number>(() => Math.max(0, Math.round(sum.cash * 0.7)));
  const open = openBills(db, today).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.bill.dueDate.localeCompare(b.bill.dueDate));
  const plan = paymentPlan(db, today, budget);
  const planned = plan.reduce((s, r) => s + r.pay, 0);
  const closed = (db.bills ?? []).filter((b) => b.status !== "ouverte").map((b) => billState(db, b, today));
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Dettes fournisseurs et prestataires"
        subtitle="Ce que vous devez, à qui, pour quand — et ce que vos ventes permettent déjà de rembourser"
        trail={[{ label: "Achats", href: "/achats" }]}
        actions={(can("achats", "create") || can("finances", "create")) && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setCreate(true)}>Nouvelle dette</Button>}
      />
      <PayablesKpis />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "plan", label: "Plan de règlement" },
          { key: "fournisseurs", label: "Par fournisseur", count: sum.suppliers.length },
          { key: "factures", label: "Factures à payer", count: open.length },
          { key: "soldees", label: "Soldées / annulées", count: closed.length },
        ]}
      />

      {tab === "plan" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Budget que je peux consacrer aux fournisseurs
              <input type="number" min={0} step={5000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-1 block h-10 w-48 rounded-lg border border-gray-300 bg-transparent px-3 text-sm tabular-nums dark:border-gray-700 dark:text-white/90" />
            </label>
            <p className="text-theme-xs text-gray-500">Trésorerie disponible : {formatXOF(sum.cash)}. Ordre suggéré : l&apos;échu d&apos;abord, puis ce que les ventes couvrent déjà, puis les échéances des 7 jours.</p>
            <p className="ms-auto text-sm">Paiements proposés : <strong className="tabular-nums">{formatXOF(planned)}</strong></p>
          </div>
          <DataTable
            rows={plan}
            rowKey={(r) => r.s.bill.id}
            emptyTitle="Rien à payer pour l'instant"
            columns={[
              { key: "f", header: "Fournisseur", primary: true, render: (r) => <span className="flex flex-col"><Link href={`/achats/fournisseurs/${r.s.bill.supplierId}`} className="font-medium hover:underline">{r.s.supplier?.name}</Link><span className="text-[11px] text-gray-500">{r.s.bill.code} · {r.s.bill.label}</span></span> },
              { key: "r", header: "Pourquoi", render: (r) => <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.reason === "Échue" ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : r.reason === "Couverte par les ventes" ? "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300" : "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300")}>{r.reason}</span> },
              { key: "e", header: "Échéance", render: (r) => formatDate(r.s.bill.dueDate) },
              { key: "rest", header: "Reste dû", align: "end", render: (r) => formatXOF(r.s.remaining) },
              { key: "p", header: "À payer maintenant", align: "end", render: (r) => <strong className={cn("tabular-nums", r.pay < r.want && "text-warning-700")}>{formatXOF(r.pay)}{r.pay < r.want ? " (budget)" : ""}</strong> },
              { key: "x", header: "", render: (r) => r.pay > 0 && <Button size="xs" onClick={() => setPay({ s: r.s, amount: r.pay })}>Payer</Button> },
            ]}
          />
        </section>
      )}

      {tab === "fournisseurs" && (
        <DataTable
          rows={sum.suppliers}
          rowKey={(x) => x.supplier.id}
          emptyTitle="Aucune dette"
          columns={[
            { key: "n", header: "Fournisseur / prestataire", primary: true, render: (x) => <span className="flex flex-col"><Link href={`/achats/fournisseurs/${x.supplier.id}`} className="font-medium hover:underline">{x.supplier.name}</Link><span className="text-[11px] text-gray-500">{x.supplier.kind === "prestataire" ? "Prestataire" : "Fournisseur"} · {x.supplier.paymentTerms} · {x.supplier.phone}</span></span> },
            { key: "b", header: "Factures", align: "center", render: (x) => x.bills },
            { key: "r", header: "Reste à payer", align: "end", sortValue: (x) => x.remaining, render: (x) => <strong className="tabular-nums">{formatXOF(x.remaining)}</strong> },
            { key: "o", header: "Échu", align: "end", sortValue: (x) => x.overdue, render: (x) => <span className={cn("tabular-nums", x.overdue && "font-semibold text-error-600")}>{formatXOF(x.overdue)}</span> },
            { key: "s", header: "Sous 7 j", align: "end", render: (x) => formatXOF(x.dueSoon) },
            { key: "c", header: "Couvert par les ventes", align: "end", render: (x) => <span className="text-tertiary-700 tabular-nums dark:text-tertiary-300">{formatXOF(x.payableNow)}</span> },
            { key: "d", header: "Prochaine échéance", render: (x) => (x.nextDue ? formatDate(x.nextDue) : "—") },
          ]}
        />
      )}

      {tab === "factures" && <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">{open.map((s) => <BillItem key={s.bill.id} s={s} onPay={(x) => setPay({ s: x })} />)}</ul>}
      {tab === "soldees" && <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">{closed.map((s) => <BillItem key={s.bill.id} s={s} onPay={() => undefined} />)}</ul>}

      <PayBillModal state={pay?.s ?? null} suggested={pay?.amount} onClose={() => setPay(null)} />
      <BillFormModal isOpen={create} onClose={() => setCreate(false)} />
    </div>
  );
}
