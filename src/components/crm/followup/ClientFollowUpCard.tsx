"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import { TextAreaField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { recordContact } from "@/lib/services/followUpService";
import type { Interaction } from "@/lib/types";
import { useEffect, useState } from "react";
import { ChannelPicker, channelLabel, fmtDue, StartPlanModal, TouchContactModal, type TouchTarget } from "./FollowUpModals";
import { PlanTimeline } from "./FollowUpPlans";

/** Consigner un appel reçu, un message envoyé ou une visite, hors parcours de relance. */
export function RecordContactModal({ clientId, isOpen, onClose }: { clientId: string; isOpen: boolean; onClose: () => void }) {
  const { run } = useDemo();
  const [channel, setChannel] = useState<Interaction["channel"]>("appel");
  const [summary, setSummary] = useState("");
  useEffect(() => {
    if (isOpen) {
      setChannel("appel");
      setSummary("");
    }
  }, [isOpen]);
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Consigner un contact"
      description="Appel reçu ou passé, message, visite : tout échange est noté dans l'historique du client."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={() => run(recordContact, { clientId, channel, summary }).ok && onClose()} disabled={!summary.trim()}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-3">
        <ChannelPicker value={channel} onChange={setChannel} />
        <TextAreaField label="Résumé de l'échange" required value={summary} onChange={setSummary} rows={3} placeholder="Ex. : appel pour demander le prix d'un vaccin ; rappel prévu jeudi." />
      </div>
    </AppModal>
  );
}

export default function ClientFollowUpCard({ clientId }: { clientId: string }) {
  const { db, today, can } = useDemo();
  const [record, setRecord] = useState(false);
  const [start, setStart] = useState(false);
  const [contact, setContact] = useState<TouchTarget | null>(null);
  const editable = can("relation", "update");
  const plans = (db.followUps ?? []).filter((p) => p.clientId === clientId && p.status === "actif");
  const contacts = db.interactions.filter((i) => i.clientId === clientId).slice(0, 4);
  return (
    <ComponentCard
      title="Suivi et contacts"
      className="lg:col-span-2"
      actions={
        editable && (
          <>
            <Button size="xs" onClick={() => setRecord(true)}>Consigner un contact</Button>
            <Button size="xs" variant="ghost" onClick={() => setStart(true)}>Démarrer un suivi</Button>
          </>
        )
      }
    >
      {plans.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucun suivi en cours. Il démarrera automatiquement à la prochaine consultation validée.</p>
      ) : (
        <ul className="space-y-4">
          {plans.map((p) => {
            const next = p.touches.find((t) => t.status === "a_faire");
            return (
              <li key={p.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{p.label}</p>
                  {next && (
                    <span className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
                      Prochaine relance {next.stage} · <span className={next.dueDate < today ? "font-medium text-error-600" : ""}>{fmtDue(next.dueDate, today)}</span>
                      {editable && next.dueDate <= today && (
                        <Button size="xs" variant="soft" onClick={() => setContact({ plan: p, touch: next, channel: "whatsapp" })}>
                          Relancer
                        </Button>
                      )}
                    </span>
                  )}
                </div>
                <PlanTimeline plan={p} />
              </li>
            );
          })}
        </ul>
      )}
      <div>
        <p className="mb-1.5 text-theme-xs font-medium tracking-wide text-gray-500 uppercase">Derniers contacts</p>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Aucun contact enregistré.</p>
        ) : (
          <ul className="space-y-1.5">
            {contacts.map((i) => (
              <li key={i.id} className="text-sm text-gray-700 dark:text-gray-300">
                <span className="text-theme-xs text-gray-500 tabular-nums">{formatDateTime(i.date)}</span> · <span className="font-medium">{channelLabel(i.channel)}</span> · {db.users.find((u) => u.id === i.userId)?.name} — {i.summary}
              </li>
            ))}
          </ul>
        )}
        <Link href="/relation-client/suivi" className="mt-2 inline-block text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
          Toutes les relances →
        </Link>
      </div>
      <RecordContactModal clientId={clientId} isOpen={record} onClose={() => setRecord(false)} />
      <StartPlanModal isOpen={start} onClose={() => setStart(false)} clientId={clientId} />
      <TouchContactModal target={contact} onClose={() => setContact(null)} />
    </ComponentCard>
  );
}
