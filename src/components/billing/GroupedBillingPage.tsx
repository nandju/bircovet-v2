"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { SelectField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { patientName, userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { billableConsultations, createGroupedInvoice } from "@/lib/services/invoicesService";
import { cn } from "@/utils";
import { useMemo, useState } from "react";

export default function GroupedBillingPage() {
  const { db, run } = useDemo();
  const router = useRouter();
  const payers = useMemo(() => db.clients.filter((c) => billableConsultations(db, c.id).length > 0).map((c) => ({ value: c.id, label: `${c.name} (${billableConsultations(db, c.id).length} visite(s))` })), [db]);
  const [client, setClient] = useState(payers.find((p) => p.label.startsWith("Résidence"))?.value ?? "");
  const [sel, setSel] = useState<string[]>([]);
  const visits = client ? billableConsultations(db, client) : [];
  const invoiced = client ? db.consultations.filter((c) => c.clientId === client && c.invoiceId).slice(0, 5) : [];
  const total = visits.filter((v) => sel.includes(v.id)).reduce((s, v) => s + v.acts.reduce((a, x) => a + x.qty * x.unitPrice, 0), 0);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Facturation regroupée" trail={[{ label: "Facturation", href: "/facturation" }]} />
      <DemoNotice>Sélectionnez plusieurs visites d&apos;un même payeur. Chaque ligne conserve sa visite d&apos;origine ; une visite déjà facturée ne peut pas être ajoutée une seconde fois.</DemoNotice>
      <ComponentCard title="Payeur">
        <SelectField label="Client payeur (visites non facturées)" value={client} onChange={(x) => { setClient(x); setSel([]); }} options={payers} />
      </ComponentCard>
      {client && (
        <ComponentCard
          title="Visites facturables"
          actions={
            <Button size="sm" disabled={!sel.length} onClick={() => { const r = run(createGroupedInvoice, { clientId: client, consultationIds: sel }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>
              Générer la facture ({sel.length} visite(s) · {formatXOF(total)})
            </Button>
          }
        >
          {visits.length === 0 ? (
            <EmptyState title="Aucune visite facturable pour ce payeur" />
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => {
                const checked = sel.includes(v.id);
                return (
                  <li key={v.id}>
                    <label className={cn("flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border p-3", checked ? "border-brand-300 bg-brand-25 dark:border-brand-700 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-800")}>
                      <input type="checkbox" checked={checked} onChange={() => setSel(checked ? sel.filter((x) => x !== v.id) : [...sel, v.id])} className="size-4 rounded text-brand-500" />
                      <span className="min-w-0 flex-1 text-sm">
                        <strong>{v.code}</strong> — {formatDate(v.date)} · {patientName(db, v.patientId)} · {v.reason}
                        <span className="block text-theme-xs text-gray-500">{v.acts.map((a) => a.label).join(", ")} · {userName(db, v.vetId)}</span>
                      </span>
                      <StatusBadge kind="financial" value={v.financialStatus} />
                      <strong className="text-sm">{formatXOF(v.acts.reduce((a, x) => a + x.qty * x.unitPrice, 0))}</strong>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {invoiced.length > 0 && (
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-1 text-theme-xs font-medium text-gray-500 uppercase">Déjà facturées (non sélectionnables)</p>
              {invoiced.map((v) => (
                <p key={v.id} className="text-sm text-gray-400">
                  {v.code} — {formatDate(v.date)} · facture {db.invoices.find((i) => i.id === v.invoiceId)?.code}
                </p>
              ))}
            </div>
          )}
        </ComponentCard>
      )}
    </div>
  );
}
