"use client";

import AccessDenied from "@/components/common/AccessDenied";
import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import LinkedDocuments from "@/components/documents/LinkedDocuments";
import { DeliveryModal, PrescriptionModal } from "@/components/prescriptions/PrescriptionModals";
import PrescriptionsTable from "@/components/prescriptions/PrescriptionsTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link, useRouter } from "@/i18n/navigation";
import { PlusIcon, PrinterIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatDate, formatDateTime, formatXOF } from "@/lib/format";
import {
  decidePaymentException,
  markPrepaid,
  recordEuthanasia,
  requestPaymentException,
  returnToDraft,
  submitConsultation,
  updateConsultation,
  validateConsultation,
  type ConsultationInput,
} from "@/lib/services/consultationsService";
import { createGroupedInvoice } from "@/lib/services/invoicesService";
import type { Prescription } from "@/lib/types";
import { printPage } from "@/utils/export";
import { useEffect, useState } from "react";
import ConsultationEditor from "./ConsultationEditor";

export default function ConsultationDetail({ id }: { id: string }) {
  const { db, run, user, can } = useDemo();
  const router = useRouter();
  const c = db.consultations.find((x) => x.id === id);
  const [draft, setDraft] = useState<ConsultationInput | null>(null);
  const [deliver, setDeliver] = useState<Prescription | null>(null);
  const rx = useModal();
  const ret = useModal();
  const exc = useModal();
  const euth = useModal();
  useEffect(() => {
    if (c && c.status !== "valide") setDraft({ ...c });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, c?.status]);
  if (!c) return <p className="text-sm text-gray-500">Consultation introuvable.</p>;
  if (user?.roleId === "confrere" && (!(user.sharedPatientIds ?? []).includes(c.patientId) || c.status !== "valide")) return <AccessDenied what="Cette consultation (non partagée)" />;

  const prescriptions = db.prescriptions.filter((p) => p.consultationId === c.id);
  const isVetResp = user?.roleId === "dg" || (user?.roleId === "vet" && user.id === c.vetId);
  const editing = c.status !== "valide" && draft && can("consultations", "create");
  const total = c.acts.reduce((s, a) => s + a.qty * a.unitPrice, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={`${c.code} — ${patientName(db, c.patientId)}`}
        subtitle={`${formatDateTime(c.date)} · ${c.reason}`}
        trail={[{ label: "Consultations", href: "/consultations" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={printPage}>
              Imprimer
            </Button>
            {editing && (
              <>
                <Button size="sm" variant="outline" onClick={() => draft && run(updateConsultation, { id: c.id, patch: draft })}>
                  Enregistrer le brouillon
                </Button>
                {c.status === "brouillon" && (
                  <Button size="sm" variant="secondary" onClick={() => { if (draft && run(updateConsultation, { id: c.id, patch: draft }, { silent: true }).ok) run(submitConsultation, { id: c.id }); }}>
                    Soumettre à validation
                  </Button>
                )}
              </>
            )}
            {c.status !== "valide" && isVetResp && (
              <Button size="sm" onClick={() => { if (draft && run(updateConsultation, { id: c.id, patch: draft }, { silent: true }).ok) run(validateConsultation, { id: c.id }); }}>
                Valider (vétérinaire responsable)
              </Button>
            )}
            {c.status === "a_valider" && isVetResp && (
              <Button size="sm" variant="ghost" onClick={ret.openModal}>
                Renvoyer en brouillon
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-sm text-gray-500">Statut clinique :</span>
        <StatusBadge kind="clinical" value={c.status} size="md" />
        <span className="ms-3 text-sm text-gray-500">Statut financier :</span>
        <StatusBadge kind="financial" value={c.financialStatus} size="md" />
        {c.syncStatus && <StatusBadge kind="sync" value={c.syncStatus} />}
      </div>

      {editing && draft ? (
        <ConsultationEditor value={draft} onChange={setDraft} lockParties actsLocked={!!c.invoiceId} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
          <div className="space-y-4 xl:col-span-2">
            <ComponentCard title="Compte rendu de consultation" desc={c.status === "valide" ? `Validé par ${userName(db, c.validatedById)} le ${formatDateTime(c.validatedAt)}` : undefined}>
              <InfoGrid
                items={[
                  { label: "Client", value: clientName(db, c.clientId) },
                  { label: "Patient", value: <Link className="text-brand-600 hover:underline" href={`/patients/${c.patientId}`}>{patientName(db, c.patientId)}</Link> },
                  { label: "Vétérinaire responsable", value: userName(db, c.vetId) },
                  { label: "Auteur de la saisie", value: userName(db, c.authorId) },
                  { label: "Constantes", value: [c.weightKg && `${c.weightKg} kg`, c.temperature && `${c.temperature} °C`, c.heartRate && `${c.heartRate} bpm`].filter(Boolean).join(" · ") },
                  { label: "Contrôle recommandé", value: c.followUpDate ? formatDate(c.followUpDate) : "—" },
                  { label: "Anamnèse", value: c.anamnesis, wide: true },
                  { label: "Examen clinique", value: c.exam, wide: true },
                  { label: "Hypothèses", value: c.hypotheses, wide: true },
                  { label: "Diagnostic retenu", value: c.diagnosis, wide: true },
                  { label: "Examens complémentaires", value: c.complementaryExams, wide: true },
                  { label: "Plan de soins", value: <span className="whitespace-pre-wrap">{c.carePlan}</span>, wide: true },
                  { label: "Observations", value: c.observations, wide: true },
                ]}
              />
              {c.euthanasiaRecorded && <DemoNotice tone="warning">Un acte d&apos;euthanasie a été saisi. Conformément aux règles de la démonstration, le statut vital du patient n&apos;est pas modifié automatiquement.</DemoNotice>}
              <p className="hidden text-theme-xs text-gray-500 print:block">{db.settings.documentFooter}</p>
            </ComponentCard>
          </div>
          <ComponentCard title="Actes">
            {c.acts.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span>
                  {a.label} × {a.qty}
                </span>
                <span>{formatXOF(a.qty * a.unitPrice)}</span>
              </div>
            ))}
            <p className="border-t border-gray-100 pt-2 text-end text-sm font-semibold dark:border-gray-800">{formatXOF(total)}</p>
          </ComponentCard>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 print:hidden">
        <ComponentCard title="Statut financier" desc="Règle habituelle : paiement préalable. Exceptions soumises à approbation DG.">
          <div className="space-y-3 text-sm">
            {c.paymentException && (
              <p className="text-gray-600 dark:text-gray-400">
                Exception demandée par {userName(db, c.paymentException.requestedById)} : « {c.paymentException.reason} »{c.paymentException.decision && ` — ${c.paymentException.decision === "approuvee" ? "approuvée" : "refusée"} par ${userName(db, c.paymentException.decidedById)}`}
              </p>
            )}
            {c.invoiceId && (
              <p>
                Facturée :{" "}
                <Link className="font-medium text-brand-600 hover:underline" href={`/facturation/factures/${c.invoiceId}`}>
                  {db.invoices.find((i) => i.id === c.invoiceId)?.code}
                </Link>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {c.financialStatus === "non_regle" && can("facturation", "create") && (
                <>
                  <Button size="xs" variant="soft" onClick={() => run(markPrepaid, { id: c.id })}>
                    Constater le paiement préalable
                  </Button>
                  <Button size="xs" variant="outline" onClick={exc.openModal}>
                    Demander une exception
                  </Button>
                </>
              )}
              {c.financialStatus === "exception_demandee" && user?.roleId === "dg" && (
                <>
                  <Button size="xs" onClick={() => run(decidePaymentException, { id: c.id, approve: true })}>Approuver (DG)</Button>
                  <Button size="xs" variant="outline" onClick={() => run(decidePaymentException, { id: c.id, approve: false })}>Refuser</Button>
                </>
              )}
              {!c.invoiceId && can("facturation", "create") && (
                <Button size="xs" variant="secondary" onClick={() => { const r = run(createGroupedInvoice, { clientId: c.clientId, consultationIds: [c.id] }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>
                  Facturer les actes
                </Button>
              )}
            </div>
          </div>
        </ComponentCard>
        <ComponentCard title="Suivi et contrôle">
          <div className="flex flex-wrap gap-2">
            {can("agenda", "create") && (
              <Button size="xs" variant="outline" onClick={() => router.push("/agenda?nouveau=1")}>
                Planifier un contrôle
              </Button>
            )}
            {(user?.roleId === "dg" || user?.roleId === "vet") && !c.euthanasiaRecorded && (
              <Button size="xs" variant="ghost" onClick={euth.openModal}>
                Saisir un acte d&apos;euthanasie
              </Button>
            )}
          </div>
          <p className="text-theme-xs text-gray-500">La déclaration de décès se fait séparément depuis la fiche patient, avec confirmation explicite.</p>
        </ComponentCard>
      </div>

      <ComponentCard
        title="Prescriptions"
        className="print:hidden"
        actions={
          can("prescriptions", "create") && (
            <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={rx.openModal}>
              Prescrire
            </Button>
          )
        }
      >
        <PrescriptionsTable rows={prescriptions} onDeliver={setDeliver} />
      </ComponentCard>

      <ComponentCard title="Examens et documents" className="print:hidden">
        <LinkedDocuments refs={[{ kind: "consultation", id: c.id }]} addTo={{ kind: "consultation", id: c.id }} />
      </ComponentCard>

      <PrescriptionModal isOpen={rx.isOpen} onClose={rx.closeModal} patientId={c.patientId} consultationId={c.id} />
      <DeliveryModal prescription={deliver} onClose={() => setDeliver(null)} />
      <ConfirmDialog isOpen={ret.isOpen} onClose={ret.closeModal} title="Renvoyer en brouillon" message="L'auteur pourra compléter le dossier." reasonLabel="Motif" onConfirm={(reason) => run(returnToDraft, { id: c.id, reason }).ok} />
      <ConfirmDialog isOpen={exc.isOpen} onClose={exc.closeModal} title="Exception au paiement préalable" message="La demande sera soumise à l'approbation du DG." reasonLabel="Motif" onConfirm={(reason) => run(requestPaymentException, { id: c.id, reason }).ok} />
      <ConfirmDialog isOpen={euth.isOpen} onClose={euth.closeModal} title="Saisir un acte d'euthanasie" tone="danger" message="L'acte est tracé. Le statut vital du patient NE sera PAS modifié automatiquement : une déclaration de décès distincte reste nécessaire." confirmLabel="Saisir l'acte" onConfirm={() => run(recordEuthanasia, { id: c.id }).ok} />
    </div>
  );
}
