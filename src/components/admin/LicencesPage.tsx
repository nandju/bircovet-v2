"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDate, formatDateTime, formatXOF } from "@/lib/format";
import { recordLicencePayment } from "@/lib/services/adminService";
import { userName } from "@/lib/calc";
import { useState } from "react";

/** Suivi des licences par cabinet — statuts, échéances, historique. Aucun paiement réel. */
export default function LicencesPage() {
  const { db, run, user, today } = useDemo();
  const [confirm, setConfirm] = useState<string | null>(null);
  const isDG = user?.roleId === "dg";

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Suivi des licences" trail={[{ label: "Administration", href: "/administration/parametres" }]} />
      <DemoNotice>
        Enregistrement commercial uniquement : aucun encaissement n&apos;est réalisé dans cette démonstration. Le paiement réel nécessitera un prestataire configuré et une confirmation de transaction — les statuts « payée » sont des confirmations saisies manuellement.
      </DemoNotice>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-6">
        {db.licences.map((l) => (
          <ComponentCard
            key={l.id}
            title={l.orgName}
            desc={l.period}
            actions={
              <span className="flex items-center gap-2">
                <StatusBadge kind="licence" value={l.status === "en_attente" && l.dueDate < today ? "en_retard" : l.status} />
                {l.status !== "payee" && isDG && (
                  <Button size="xs" onClick={() => setConfirm(l.id)}>Confirmer le paiement</Button>
                )}
              </span>
            }
          >
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Échéance : <strong className={l.dueDate < today && l.status !== "payee" ? "text-error-600" : ""}>{formatDate(l.dueDate)}</strong></span>
              <span className="font-semibold text-gray-800 dark:text-white/90">{formatXOF(l.amount)}</span>
            </div>
            <p className="mb-1.5 text-theme-xs font-medium text-gray-500">Historique</p>
            <ul className="space-y-1.5 text-sm">
              {l.history.map((h, i) => (
                <li key={i} className="text-gray-600 dark:text-gray-400">
                  <span className="text-theme-xs text-gray-400">{formatDateTime(h.date)}</span> — {h.action}
                  {h.amount ? ` · ${formatXOF(h.amount)}` : ""}
                  {h.note ? ` — ${h.note}` : ""}
                  {h.userId ? ` · ${userName(db, h.userId)}` : ""}
                </li>
              ))}
            </ul>
          </ComponentCard>
        ))}
        {!db.licences.length && <p className="text-sm text-gray-500">Aucune licence enregistrée.</p>}
      </div>
      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title="Confirmer le paiement de licence"
        message="Saisie manuelle de confirmation — aucun paiement réel n'est effectué dans la démonstration."
        reasonLabel="Référence / note de paiement"
        onConfirm={(note) => {
          const l = db.licences.find((x) => x.id === confirm);
          return l ? run(recordLicencePayment, { id: l.id, amount: l.amount, note }).ok : false;
        }}
      />
    </div>
  );
}
