"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { clientName, clientOutstanding, userName } from "@/lib/calc";
import { addDays, formatDate, formatDateTime, formatXOF } from "@/lib/format";
import { decideCredit, requestCredit } from "@/lib/services/financesService";
import type { CreditRequest } from "@/lib/types";
import { useState } from "react";

export default function CreditsPage() {
  const { db, run, user, today, can } = useDemo();
  const opts = useOptions();
  const create = useModal();
  const [v, setV] = useState({ clientId: "", ceiling: NaN, dueDate: "", reason: "" });
  const [decision, setDecision] = useState<{ c: CreditRequest; approve: boolean } | null>(null);
  const isDG = user?.roleId === "dg";
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Crédits clients"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={
          (can("finances", "create") || can("facturation", "create")) && (
            <Button size="sm" onClick={() => { setV({ clientId: "", ceiling: NaN, dueDate: addDays(today, 30), reason: "" }); create.openModal(); }}>
              Demander un crédit
            </Button>
          )
        }
      />
      <DemoNotice>Tout crédit exige une autorisation préalable simulée du DG : plafond, échéance, motif, auteur, décision et historique sont tracés. La décision n&apos;est pas possible en mode hors ligne.</DemoNotice>
      {db.credits.length === 0 && <EmptyState title="Aucune demande de crédit" />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {db.credits.map((c) => (
          <ComponentCard
            key={c.id}
            title={`${c.code} — ${clientName(db, c.clientId)}`}
            desc={`Demandé par ${userName(db, c.requestedById)} le ${formatDate(c.date)}`}
            actions={<StatusBadge kind="credit" value={c.status} size="md" />}
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-theme-xs text-gray-500">Plafond</p><p className="font-semibold">{formatXOF(c.ceiling)}</p></div>
              <div><p className="text-theme-xs text-gray-500">Échéance</p><p className="font-semibold">{formatDate(c.dueDate)}</p></div>
              <div className="col-span-2"><p className="text-theme-xs text-gray-500">Motif</p><p>{c.reason}</p></div>
              <div className="col-span-2"><p className="text-theme-xs text-gray-500">Encours actuel du client</p><p>{formatXOF(clientOutstanding(db, c.clientId))}</p></div>
              {c.decisionNote && <div className="col-span-2"><p className="text-theme-xs text-gray-500">Décision</p><p>{c.decisionNote} — {userName(db, c.decidedById)}, {formatDateTime(c.decidedAt)}</p></div>}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Historique ({c.history.length})</summary>
              <ul className="mt-1 space-y-1">
                {c.history.map((h, i) => (
                  <li key={i} className="text-theme-xs text-gray-500">{formatDateTime(h.date)} — {h.action} ({userName(db, h.userId)}){h.note && ` : ${h.note}`}</li>
                ))}
              </ul>
            </details>
            {c.status === "en_attente" &&
              (isDG ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDecision({ c, approve: true })}>Approuver</Button>
                  <Button size="sm" variant="outline" onClick={() => setDecision({ c, approve: false })}>Refuser</Button>
                </div>
              ) : (
                <p className="text-theme-xs text-warning-700 dark:text-warning-400">En attente de la décision du DG (changez de profil pour tester l&apos;approbation).</p>
              ))}
          </ComponentCard>
        ))}
      </div>
      <AppModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        title="Demande de crédit"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={create.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!v.clientId || !(v.ceiling > 0) || !v.reason.trim()} onClick={() => run(requestCredit, v).ok && create.closeModal()}>Soumettre au DG</Button>
          </>
        }
      >
        <FormGrid>
          <SelectField label="Client" required value={v.clientId} onChange={(clientId) => setV({ ...v, clientId })} options={opts.clients} className="sm:col-span-2" />
          <NumberField label="Plafond" required suffix="FCFA" value={v.ceiling} onChange={(ceiling) => setV({ ...v, ceiling })} min={0} step={5000} />
          <TextField label="Échéance" required type="date" value={v.dueDate} onChange={(dueDate) => setV({ ...v, dueDate })} />
          <TextAreaField label="Motif" required value={v.reason} onChange={(reason) => setV({ ...v, reason })} rows={2} className="sm:col-span-2" />
        </FormGrid>
      </AppModal>
      <ConfirmDialog isOpen={!!decision} onClose={() => setDecision(null)} title={decision?.approve ? "Approuver le crédit" : "Refuser le crédit"} message={decision ? `${decision.c.code} — plafond ${formatXOF(decision.c.ceiling)}, échéance ${formatDate(decision.c.dueDate)}` : ""} reasonLabel="Commentaire de décision" tone={decision?.approve ? "primary" : "danger"} onConfirm={(note) => (decision ? run(decideCredit, { id: decision.c.id, approve: decision.approve, note }).ok : false)} />
    </div>
  );
}
