"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { NumberField, SelectField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { DownloadIcon, PlusIcon } from "@/icons";
import { accountName, clientName, invoiceBalance, isActiveInvoice, paymentUnallocated, userName } from "@/lib/calc";
import { addDays, formatDate, formatXOF } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { allocatePayment } from "@/lib/services/paymentsService";
import type { Payment } from "@/lib/types";
import { exportCsv } from "@/utils/export";
import { useEffect, useMemo, useState } from "react";
import PaymentModal from "./PaymentModal";

export default function PaymentsPage() {
  const { db, run, today } = useDemo();
  const create = useModal();
  const nouveau = useQueryParam("nouveau");
  const openCreate = create.openModal;
  useEffect(() => {
    if (nouveau) openCreate();
  }, [nouveau, openCreate]);
  const [f, setF] = useState<Record<string, string>>({ period: "30" });
  const [alloc, setAlloc] = useState<Payment | null>(null);
  const [allocInv, setAllocInv] = useState("");
  const [allocAmt, setAllocAmt] = useState(NaN);
  const rows = useMemo(() => {
    const from = f.period ? addDays(today, -Number(f.period)) : "";
    return db.payments.filter((p) => p.date >= from && (!f.method || p.method === f.method) && (!f.kind || p.kind === f.kind) && (!f.account || p.accountId === f.account));
  }, [db, f, today]);
  const total = rows.reduce((s, p) => s + p.amount, 0);
  const allocTargets = alloc ? db.invoices.filter((i) => i.clientId === alloc.clientId && i.kind === "facture" && isActiveInvoice(i) && invoiceBalance(db, i) > 0) : [];

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Encaissements"
        subtitle={`${rows.length} encaissement(s) · ${formatXOF(total)} sur la période`}
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => exportCsv("bircovet-encaissements-demo", ["Réf.", "Date", "Client", "Montant", "Moyen", "Compte", "Nature", "Non affecté", "Référence"], rows.map((p) => [p.code, formatDate(p.date), clientName(db, p.clientId), p.amount, labelOf("paymentMethod", p.method), accountName(db, p.accountId), labelOf("paymentKind", p.kind), paymentUnallocated(p), p.reference]))}>
              Export CSV
            </Button>
            <Can module="finances" action="create">
              <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
                Encaisser
              </Button>
            </Can>
          </>
        }
      />
      <Panel>
        <FilterBar
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "period", label: "Toute période", options: [{ value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }, { value: "365", label: "12 mois" }] },
            { key: "method", label: "Tous moyens", options: optionsOf("paymentMethod") },
            { key: "kind", label: "Toutes natures", options: optionsOf("paymentKind") },
            { key: "account", label: "Tous comptes", options: db.accounts.map((a) => ({ value: a.id, label: a.name })) },
          ]}
        />
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (p) => <span className="font-medium">{p.code}</span> },
            { key: "d", header: "Date", sortValue: (p) => p.date, render: (p) => formatDate(p.date) },
            { key: "cl", header: "Client", render: (p) => clientName(db, p.clientId) },
            { key: "m", header: "Moyen", render: (p) => <StatusBadge kind="paymentMethod" value={p.method} /> },
            { key: "ac", header: "Compte", render: (p) => accountName(db, p.accountId), hideOnMobile: true },
            { key: "k", header: "Nature", render: (p) => <StatusBadge kind="paymentKind" value={p.kind} /> },
            { key: "al", header: "Affectation", hideOnMobile: true, render: (p) => p.allocations.map((a) => db.invoices.find((i) => i.id === a.invoiceId)?.code ?? db.openingReceivables.find((r) => r.id === a.receivableId)?.code).filter(Boolean).join(", ") || "—" },
            { key: "a", header: "Montant", align: "end", sortValue: (p) => p.amount, render: (p) => formatXOF(p.amount) },
            {
              key: "u",
              header: "Non affecté",
              align: "end",
              render: (p) => {
                const u = paymentUnallocated(p);
                return u > 0 ? (
                  <span className="flex items-center justify-end gap-2">
                    <span className="font-medium text-tertiary-600">{formatXOF(u)}</span>
                    <Button size="xs" variant="soft" onClick={() => { setAlloc(p); setAllocInv(""); setAllocAmt(u); }}>
                      Affecter
                    </Button>
                  </span>
                ) : (
                  "—"
                );
              },
            },
            { key: "us", header: "Par", hideOnMobile: true, render: (p) => userName(db, p.userId) },
          ]}
          emptyTitle="Aucun encaissement"
        />
      </Panel>
      <PaymentModal isOpen={create.isOpen} onClose={create.closeModal} />
      <AppModal
        isOpen={!!alloc}
        onClose={() => setAlloc(null)}
        title="Affecter un acompte / trop-perçu"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setAlloc(null)}>
              Annuler
            </Button>
            <Button size="sm" disabled={!allocInv || !(allocAmt > 0)} onClick={() => alloc && run(allocatePayment, { paymentId: alloc.id, invoiceId: allocInv, amount: allocAmt }).ok && setAlloc(null)}>
              Affecter
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField label="Facture" value={allocInv} onChange={setAllocInv} options={allocTargets.map((i) => ({ value: i.id, label: `${i.code} — solde ${formatXOF(invoiceBalance(db, i))}` }))} />
          <NumberField label="Montant" suffix="FCFA" value={allocAmt} onChange={setAllocAmt} min={0} />
        </div>
      </AppModal>
    </div>
  );
}
