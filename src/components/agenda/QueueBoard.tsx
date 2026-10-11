"use client";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import PaymentModal from "@/components/finances/PaymentModal";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatTime } from "@/lib/format";
import { allowedQueueTransitions, setQueueStatus } from "@/lib/services/appointmentsService";
import type { Appointment, QueueStatus } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const COLUMNS: { key: QueueStatus; label: string }[] = [
  { key: "attendu", label: "Attendus" },
  { key: "arrive", label: "Arrivés" },
  { key: "regle", label: "Consultation réglée" },
  { key: "en_consultation", label: "En consultation" },
  { key: "termine", label: "Terminés" },
  { key: "annule", label: "Annulés" },
];

const ACTION_LABEL: Partial<Record<QueueStatus, string>> = { arrive: "Marquer arrivé", regle: "Encaisser", en_consultation: "Démarrer la consultation", termine: "Terminer" };

/** File d'attente du jour : changements de statut interactifs (paiement préalable, exception DG). */
export default function QueueBoard() {
  const { db, run, today, establishment, can, user } = useDemo();
  const router = useRouter();
  const [pay, setPay] = useState<Appointment | null>(null);
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const [exception, setException] = useState<Appointment | null>(null);
  const list = db.appointments.filter((a) => a.start.startsWith(today) && a.establishmentId === establishment?.id).sort((a, b) => a.start.localeCompare(b.start));
  const editable = can("agenda", "update");

  const act = (a: Appointment, s: QueueStatus) => {
    if (s === "regle") return setPay(a);
    if (s === "annule") return setCancel(a);
    if (s === "en_consultation" && a.queueStatus === "arrive") return setException(a);
    const r = run(setQueueStatus, { id: a.id, status: s });
    if (r.ok && s === "en_consultation" && !a.consultationId && can("consultations", "create")) router.push(`/consultations/nouvelle?rdv=${a.id}`);
  };

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Accueil et file d'attente" subtitle={`${establishment?.name} · ${list.length} rendez-vous aujourd'hui`} trail={[{ label: "Agenda", href: "/agenda" }]} />
      <DemoNotice>Règle de démonstration : le paiement préalable précède la prise en charge. Une exception peut être approuvée par le profil DG, avec motif tracé au journal.</DemoNotice>
      {list.length === 0 ? (
        <EmptyState title="Aucun rendez-vous aujourd'hui pour cet établissement" action={<Link href="/agenda?nouveau=1" className="text-sm font-medium text-brand-600">Créer un rendez-vous</Link>} />
      ) : (
        <div className="custom-scrollbar -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-6 xl:overflow-visible">
          {COLUMNS.map((col) => {
            const items = list.filter((a) => a.queueStatus === col.key);
            return (
              <div key={col.key} className="w-72 shrink-0 snap-start rounded-2xl border border-gray-200 bg-gray-50/70 p-2.5 xl:w-auto dark:border-gray-800 dark:bg-white/2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{col.label}</h3>
                  <span className="rounded-full bg-white px-2 text-theme-xs text-gray-500 dark:bg-gray-800">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <div key={a.id} className={cn("rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900", col.key === "annule" && "opacity-60")}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-theme-xs font-medium text-tertiary-600 dark:text-tertiary-400">{formatTime(a.start)}</span>
                        <StatusBadge kind="appointment" value={a.status} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{patientName(db, a.patientId)}</p>
                      <p className="text-theme-xs text-gray-500">{clientName(db, a.clientId)}</p>
                      <p className="text-theme-xs text-gray-500">
                        {a.reason} · {userName(db, a.practitionerId)}
                      </p>
                      {a.consultationId && (
                        <Link href={`/consultations/${a.consultationId}`} className="mt-1 inline-block text-theme-xs font-medium text-brand-600">
                          Voir la consultation
                        </Link>
                      )}
                      {editable && allowedQueueTransitions(a.queueStatus).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {allowedQueueTransitions(a.queueStatus).map((s) =>
                            s === "annule" ? (
                              <Button key={s} size="xs" variant="ghost" className="text-error-600" onClick={() => act(a, s)}>
                                Annuler
                              </Button>
                            ) : (
                              <Button key={s} size="xs" variant={s === "regle" ? "primary" : "soft"} onClick={() => act(a, s)}>
                                {s === "en_consultation" && a.queueStatus === "arrive" ? "Sans paiement (DG)" : ACTION_LABEL[s]}
                              </Button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pay && (
        <PaymentModal
          isOpen={!!pay}
          onClose={() => setPay(null)}
          clientId={pay.clientId}
          defaultAmount={15000}
          defaultKind="acompte"
          title="Encaissement préalable à la consultation"
          onDone={() => run(setQueueStatus, { id: pay.id, status: "regle" })}
        />
      )}
      <ConfirmDialog isOpen={!!cancel} onClose={() => setCancel(null)} title="Annuler le passage" tone="danger" message="Le rendez-vous sera annulé avec son motif." reasonLabel="Motif" confirmLabel="Annuler" onConfirm={(reason) => (cancel ? run(setQueueStatus, { id: cancel.id, status: "annule", reason }).ok : false)} />
      <ConfirmDialog
        isOpen={!!exception}
        onClose={() => setException(null)}
        title="Exception au paiement préalable"
        message={user?.roleId === "dg" ? "En tant que DG, vous approuvez la prise en charge avant paiement. La décision est tracée." : "Seul le profil DG peut approuver une prise en charge sans paiement préalable. Changez de profil pour tester l'approbation."}
        reasonLabel="Motif de l'exception"
        confirmLabel="Approuver et démarrer"
        onConfirm={(reason) => {
          if (!exception) return false;
          const r = run(setQueueStatus, { id: exception.id, status: "en_consultation", reason });
          if (r.ok && !exception.consultationId && can("consultations", "create")) router.push(`/consultations/nouvelle?rdv=${exception.id}`);
          return r.ok;
        }}
      />
    </div>
  );
}
