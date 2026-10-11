"use client";

import { BarChart } from "@/components/charts/AppCharts";
import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useRouter } from "@/i18n/navigation";
import { clientName, invoiceBalance, isActiveInvoice, receivablePaid } from "@/lib/calc";
import { daysBetween, formatDate, formatXOF } from "@/lib/format";
import { createOpeningReceivable } from "@/lib/services/financesService";
import { useState } from "react";
import PaymentModal from "./PaymentModal";

export default function ReceivablesPage() {
  const { db, run, today, user, can } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const create = useModal();
  const [payClient, setPayClient] = useState<string | null>(null);
  const [v, setV] = useState({ clientId: "", label: "", amount: NaN, originDate: "" });
  const unpaid = db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i) && invoiceBalance(db, i) > 0);
  const buckets = [
    { label: "Non échu", test: (d: number) => d <= 0 },
    { label: "1–30 j", test: (d: number) => d > 0 && d <= 30 },
    { label: "31–60 j", test: (d: number) => d > 30 && d <= 60 },
    { label: "> 60 j", test: (d: number) => d > 60 },
  ];
  const aging = buckets.map((b) => unpaid.filter((i) => b.test(daysBetween(i.dueDate, today))).reduce((s, i) => s + invoiceBalance(db, i), 0));

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Créances"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={
          user?.roleId === "dg" && (
            <Button size="sm" variant="outline" onClick={() => { setV({ clientId: "", label: "Solde antérieur au démarrage", amount: NaN, originDate: "" }); create.openModal(); }}>
              Saisir une créance d&apos;ouverture
            </Button>
          )
        }
      />
      <DemoNotice>Les soldes d&apos;ouverture et anciennes créances sont distincts des ventes nouvelles. Une ancienne créance réglée aujourd&apos;hui conserve la date réelle du paiement.</DemoNotice>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <ComponentCard title="Balance âgée des factures" desc="Solde par ancienneté d'échéance">
          <BarChart labels={buckets.map((b) => b.label)} series={[{ name: "Solde", data: aging }]} currency height={240} />
        </ComponentCard>
        <ComponentCard title={`Factures impayées (${unpaid.length})`} className="xl:col-span-2">
          <DataTable
            rows={unpaid}
            rowKey={(i) => i.id}
            pageSize={6}
            onRowClick={(i) => router.push(`/facturation/factures/${i.id}`)}
            initialSort={{ key: "e", dir: "asc" }}
            columns={[
              { key: "c", header: "Facture", primary: true, render: (i) => i.code },
              { key: "cl", header: "Client", render: (i) => clientName(db, i.clientId) },
              { key: "e", header: "Échéance", sortValue: (i) => i.dueDate, render: (i) => { const d = daysBetween(i.dueDate, today); return <span className={d > 0 ? "text-error-600" : ""}>{formatDate(i.dueDate)}{d > 0 && ` (+${d} j)`}</span>; } },
              { key: "b", header: "Solde", align: "end", sortValue: (i) => invoiceBalance(db, i), render: (i) => formatXOF(invoiceBalance(db, i)) },
              { key: "s", header: "Statut", render: (i) => <StatusBadge kind="invoice" value={i.status} /> },
            ]}
          />
        </ComponentCard>
      </div>
      <ComponentCard title="Soldes d'ouverture et créances antérieures">
        <DataTable
          rows={db.openingReceivables}
          rowKey={(r) => r.id}
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (r) => r.code },
            { key: "cl", header: "Client", render: (r) => clientName(db, r.clientId) },
            { key: "l", header: "Libellé", render: (r) => r.label },
            { key: "o", header: "Origine", render: (r) => formatDate(r.originDate) },
            { key: "a", header: "Montant", align: "end", render: (r) => formatXOF(r.amount) },
            { key: "r", header: "Reste dû", align: "end", render: (r) => <strong>{formatXOF(r.amount - receivablePaid(db, r.id))}</strong> },
            { key: "x", header: "", render: (r) => r.amount - receivablePaid(db, r.id) > 0 && can("finances", "create") && <Button size="xs" variant="soft" onClick={() => setPayClient(r.clientId)}>Encaisser</Button> },
          ]}
          emptyTitle="Aucune créance antérieure"
        />
      </ComponentCard>
      {payClient && <PaymentModal isOpen={!!payClient} onClose={() => setPayClient(null)} clientId={payClient} defaultKind="ancienne_creance" title="Règlement d'une créance antérieure" />}
      <AppModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        title="Créance d'ouverture"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={create.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!v.clientId || !(v.amount > 0) || !v.originDate} onClick={() => run(createOpeningReceivable, v).ok && create.closeModal()}>Enregistrer</Button>
          </>
        }
      >
        <FormGrid>
          <SelectField label="Client" required value={v.clientId} onChange={(clientId) => setV({ ...v, clientId })} options={opts.clients} className="sm:col-span-2" />
          <TextField label="Libellé" value={v.label} onChange={(label) => setV({ ...v, label })} className="sm:col-span-2" />
          <NumberField label="Montant" required suffix="FCFA" value={v.amount} onChange={(amount) => setV({ ...v, amount })} min={0} />
          <TextField label="Date d'origine" required type="date" value={v.originDate} onChange={(originDate) => setV({ ...v, originDate })} />
        </FormGrid>
      </AppModal>
    </div>
  );
}
