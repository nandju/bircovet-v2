"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { CheckField, FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { clientName, invoiceBalance, patientName, userName } from "@/lib/calc";
import { formatDateTime, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { admitPatient, provisionalLines, stayDays, type AdmitInput } from "@/lib/services/hospitalizationsService";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";

export default function HospitalizationsList() {
  const { db, run, establishment, today, user } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const admit = useModal();
  const nouveau = useQueryParam("nouveau");
  const [f, setF] = useState<Record<string, string>>({ status: "en_cours" });
  const [client, setClient] = useState("");
  const [v, setV] = useState<AdmitInput>({ patientId: "", reason: "", cage: "", vetId: "", consentSigned: false, consentBy: "", dailyRate: 12000 });
  const openAdmit = admit.openModal;
  useEffect(() => {
    if (nouveau) openAdmit();
  }, [nouveau, openAdmit]);
  useEffect(() => {
    if (admit.isOpen) {
      setClient("");
      setV({ patientId: "", reason: "", cage: "", vetId: user && ["dg", "vet"].includes(user.roleId) ? user.id : "", consentSigned: false, consentBy: "", dailyRate: 12000 });
    }
  }, [admit.isOpen, user]);

  const occupied = new Set(db.hospitalizations.filter((h) => h.status === "en_cours" && h.establishmentId === establishment?.id).map((h) => h.cage));
  const rows = useMemo(() => db.hospitalizations.filter((h) => !f.status || h.status === f.status), [db, f]);
  const quotes = db.quotes.filter((q) => q.clientId === client && (q.status === "accepte" || q.status === "envoye"));

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Hospitalisation"
        subtitle={`${db.hospitalizations.filter((h) => h.status === "en_cours").length} séjour(s) en cours`}
        actions={
          <Can module="hospitalisation" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={admit.openModal}>
              Admission
            </Button>
          </Can>
        }
      />
      <ComponentCard title={`Emplacements — ${establishment?.name}`} desc="Occupation en temps réel">
        {establishment?.cages.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {establishment.cages.map((cage) => {
              const h = db.hospitalizations.find((x) => x.status === "en_cours" && x.cage === cage && x.establishmentId === establishment.id);
              return (
                <button key={cage} onClick={() => h && router.push(`/hospitalisation/${h.id}`)} className={cn("rounded-xl border p-3 text-start", h ? "border-warning-300 bg-warning-25 dark:border-warning-700 dark:bg-warning-500/10" : "border-dashed border-gray-200 dark:border-gray-700")}>
                  <p className="text-theme-xs text-gray-500">{cage}</p>
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{h ? patientName(db, h.patientId) : "Libre"}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun emplacement d&apos;hospitalisation dans cet établissement.</p>
        )}
      </ComponentCard>
      <Panel>
        <FilterBar values={f} onChange={(k, val) => setF((s) => ({ ...s, [k]: val }))} filters={[{ key: "status", label: "Tous les séjours", options: optionsOf("hospitalization") }]} />
        <DataTable
          rows={rows}
          rowKey={(h) => h.id}
          onRowClick={(h) => router.push(`/hospitalisation/${h.id}`)}
          columns={[
            { key: "c", header: "Séjour", primary: true, render: (h) => <span className="flex flex-col"><span className="font-medium">{h.code} — {patientName(db, h.patientId)}</span><span className="text-theme-xs text-gray-500">{h.reason}</span></span> },
            { key: "cl", header: "Client payeur", render: (h) => clientName(db, h.clientId) },
            { key: "a", header: "Admission", sortValue: (h) => h.admittedAt, render: (h) => formatDateTime(h.admittedAt) },
            { key: "d", header: "Jours", align: "center", render: (h) => stayDays(h, today) },
            { key: "e", header: "Emplacement", render: (h) => h.cage },
            { key: "v", header: "Responsable", render: (h) => userName(db, h.vetId), hideOnMobile: true },
            {
              key: "b",
              header: "Solde financier",
              align: "end",
              render: (h) => {
                const inv = db.invoices.find((i) => i.id === h.invoiceId);
                return inv ? formatXOF(invoiceBalance(db, inv)) : <span className="text-theme-xs text-gray-500">Provisoire {formatXOF(provisionalLines(h, today).reduce((s, l) => s + l.qty * l.unitPrice, 0))}</span>;
              },
            },
            { key: "s", header: "Statut", render: (h) => <StatusBadge kind="hospitalization" value={h.status} /> },
          ]}
          emptyTitle="Aucun séjour"
        />
      </Panel>
      <AppModal
        isOpen={admit.isOpen}
        onClose={admit.closeModal}
        size="lg"
        title="Admission en hospitalisation"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={admit.closeModal}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!v.patientId || !v.cage || !v.vetId || !v.reason.trim()}
              onClick={() => {
                const r = run(admitPatient, v);
                if (r.ok && r.data) {
                  admit.closeModal();
                  router.push(`/hospitalisation/${r.data}`);
                }
              }}
            >
              Admettre
            </Button>
          </>
        }
      >
        <FormGrid>
          <SelectField label="Client payeur" required value={client} onChange={(x) => { setClient(x); setV({ ...v, patientId: "", quoteId: undefined }); }} options={opts.clients} />
          <SelectField label="Patient" required value={v.patientId} onChange={(x) => setV({ ...v, patientId: x })} options={opts.patientsOf(client)} disabled={!client} />
          <SelectField label="Emplacement" required value={v.cage} onChange={(x) => setV({ ...v, cage: x })} options={(establishment?.cages ?? []).map((c) => ({ value: c, label: occupied.has(c) ? `${c} (occupé)` : c, disabled: occupied.has(c) }))} />
          <SelectField label="Vétérinaire responsable" required value={v.vetId} onChange={(x) => setV({ ...v, vetId: x })} options={opts.vets} />
          <TextAreaField label="Motif d'admission" required value={v.reason} onChange={(x) => setV({ ...v, reason: x })} rows={2} className="sm:col-span-2" />
          <SelectField label="Devis associé" value={v.quoteId ?? ""} onChange={(x) => setV({ ...v, quoteId: x || undefined })} options={quotes.map((q) => ({ value: q.id, label: `${q.code} (${q.status})` }))} allowEmpty placeholder="Aucun" />
          <NumberField label="Forfait journalier" suffix="FCFA" value={v.dailyRate} onChange={(x) => setV({ ...v, dailyRate: x })} min={0} step={500} />
          <div className="sm:col-span-2">
            <CheckField label="Consentement éclairé signé (simulation)" checked={v.consentSigned} onChange={(x) => setV({ ...v, consentSigned: x })} />
          </div>
          {v.consentSigned && <TextField label="Signataire" value={v.consentBy} onChange={(x) => setV({ ...v, consentBy: x })} />}
        </FormGrid>
      </AppModal>
    </div>
  );
}
