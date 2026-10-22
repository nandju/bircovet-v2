"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useRouter } from "@/i18n/navigation";
import { DownloadIcon, PlusIcon, ReceiptIcon, WalletIcon, AlertTriangleIcon, TimeIcon } from "@/icons";
import { clientName, docTotal, invoiceBalance, invoicePaid, isActiveInvoice } from "@/lib/calc";
import { addDays, formatDate, formatXOF, normalize } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import type { Invoice } from "@/lib/types";
import { exportCsv } from "@/utils/export";
import { useMemo, useState } from "react";
import { DocumentEditorModal } from "./BillingModals";

const TITLES: Record<Invoice["kind"], string> = { facture: "Factures", avoir: "Avoirs", proforma: "Factures pro forma" };

export default function InvoicesPage({ kind = "facture" }: { kind?: "facture" | "avoir" | "proforma" }) {
  const { db, today } = useDemo();
  const router = useRouter();
  const create = useModal();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({ period: "90" });
  const rows = useMemo(() => {
    const t = normalize(q);
    const from = f.period ? addDays(today, -Number(f.period)) : "";
    return db.invoices.filter((i) => i.kind === kind && i.date >= from && (!f.status || i.status === f.status) && (!t || normalize(`${i.code} ${i.payerName} ${clientName(db, i.clientId)}`).includes(t)));
  }, [db, q, f, today, kind]);
  const active = db.invoices.filter((i) => i.kind === "facture" && isActiveInvoice(i));
  const overdue = active.filter((i) => i.status === "en_retard");

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle={TITLES[kind]}
        subtitle="Documents de démonstration — sans valeur fiscale"
        trail={[{ label: "Facturation", href: "/facturation" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => exportCsv(`cliva-${kind}s-demo`, ["N°", "Date", "Échéance", "Client", "Payeur", "Total XOF", "Payé XOF", "Solde XOF", "Statut", "Origine (avoir)"], rows.map((i) => [i.code, formatDate(i.date), formatDate(i.dueDate), clientName(db, i.clientId), i.payerName, docTotal(i.lines), invoicePaid(db, i.id), i.kind === "facture" ? invoiceBalance(db, i) : 0, labelOf("invoice", i.status), db.invoices.find((x) => x.id === i.originalInvoiceId)?.code ?? ""]))}>
              Export CSV
            </Button>
            {(kind === "facture" || kind === "proforma") && (
              <Can module="facturation" action="create">
                <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
                  {kind === "proforma" ? "Nouveau pro forma" : "Nouvelle facture"}
                </Button>
              </Can>
            )}
          </>
        }
      />
      {kind === "facture" && (
        <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Factures validées" value={active.length} icon={<ReceiptIcon />} />
          <StatCard label="Encours client" value={formatXOF(active.reduce((s, i) => s + Math.max(0, invoiceBalance(db, i)), 0))} icon={<WalletIcon />} tone="tertiary" />
          <StatCard label="En retard" value={overdue.length} hint={formatXOF(overdue.reduce((s, i) => s + invoiceBalance(db, i), 0))} icon={<AlertTriangleIcon />} tone="error" />
          <StatCard label="À valider / brouillons" value={db.invoices.filter((i) => i.status === "a_valider" || i.status === "brouillon").length} icon={<TimeIcon />} tone="warning" />
        </div>
      )}
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="N°, client, payeur…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "status", label: "Tous statuts", options: optionsOf("invoice") },
            { key: "period", label: "Toute période", options: [{ value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }, { value: "365", label: "12 mois" }] },
          ]}
        />
        <DataTable<Invoice>
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(`/facturation/factures/${i.id}`)}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "N°", primary: true, sortValue: (i) => i.code, render: (i) => <span className="font-medium">{i.code}</span> },
            { key: "d", header: "Date", sortValue: (i) => i.date, render: (i) => formatDate(i.date) },
            { key: "cl", header: "Client / payeur", render: (i) => <span className="flex flex-col"><span>{clientName(db, i.clientId)}</span>{i.payerName !== clientName(db, i.clientId) && <span className="text-theme-xs text-gray-500">{i.payerName}</span>}</span> },
            ...(kind === "avoir" ? [{ key: "o", header: "Facture d'origine", render: (i: Invoice) => db.invoices.find((x) => x.id === i.originalInvoiceId)?.code ?? "—" }, { key: "m", header: "Motif", render: (i: Invoice) => i.correctionReason }] : kind === "proforma" ? [{ key: "cv", header: "Conversion", render: (i: Invoice) => (i.convertedToInvoiceId ? `Facture ${db.invoices.find((x) => x.id === i.convertedToInvoiceId)?.code ?? ""}` : "—") }] : [{ key: "e", header: "Échéance", sortValue: (i: Invoice) => i.dueDate, render: (i: Invoice) => formatDate(i.dueDate), hideOnMobile: true }]),
            { key: "t", header: "Total", align: "end", sortValue: (i) => docTotal(i.lines), render: (i) => formatXOF(docTotal(i.lines)) },
            ...(kind === "facture" ? [{ key: "b", header: "Solde", align: "end" as const, sortValue: (i: Invoice) => invoiceBalance(db, i), render: (i: Invoice) => (isActiveInvoice(i) ? <span className={invoiceBalance(db, i) > 0 ? "font-medium text-error-600" : "text-success-600"}>{formatXOF(invoiceBalance(db, i))}</span> : "—") }] : []),
            { key: "s", header: "Statut", render: (i) => <StatusBadge kind="invoice" value={i.status} /> },
          ]}
          emptyTitle={kind === "facture" ? "Aucune facture sur la période" : kind === "proforma" ? "Aucun pro forma" : "Aucun avoir"}
        />
      </Panel>
      <DocumentEditorModal isOpen={create.isOpen} onClose={create.closeModal} kind={kind === "proforma" ? "proforma" : "facture"} onCreated={(id) => router.push(`/facturation/factures/${id}`)} />
    </div>
  );
}
