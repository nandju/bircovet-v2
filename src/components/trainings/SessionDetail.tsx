"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import EntityHistory from "@/components/common/EntityHistory";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { Link, useRouter } from "@/i18n/navigation";
import { TrashBinIcon } from "@/icons";
import { clientName, invoiceBalance } from "@/lib/calc";
import { addDays, daysBetween, formatDate, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { invoiceSessionPayer, registerParticipant, removeParticipant, signalCapacityAttempt, toggleAttendance, updateSession } from "@/lib/services/trainingsService";
import type { TrainingSession } from "@/lib/types";
import { useState } from "react";

export default function SessionDetail({ id }: { id: string }) {
  const { db, run, can } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const [tab, setTab] = useState("participants");
  const [p, setP] = useState({ name: "", phone: "", payerClientId: "" });
  const s = db.sessions.find((x) => x.id === id);
  if (!s) return <p className="text-sm text-gray-500">Session introuvable.</p>;
  const editable = can("formations", "update");
  const dates = Array.from({ length: Math.max(1, daysBetween(s.startDate, s.endDate) + 1) }, (_, i) => addDays(s.startDate, i));
  const payers = Array.from(new Set(s.participants.map((x) => x.payerClientId)));
  const full = s.participants.length >= s.capacity;

  const register = () => {
    if (full) {
      run(signalCapacityAttempt, { sessionId: s.id, name: p.name }, { silent: true });
      run(registerParticipant, { sessionId: s.id, ...p }); // affiche le refus (capacité atteinte)
      return;
    }
    if (run(registerParticipant, { sessionId: s.id, ...p }).ok) setP({ name: "", phone: "", payerClientId: p.payerClientId });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={s.title}
        subtitle={`${s.code} · ${formatDate(s.startDate)}${s.endDate !== s.startDate ? ` → ${formatDate(s.endDate)}` : ""} · ${s.location}`}
        trail={[{ label: "Formations", href: "/formations" }]}
        actions={
          editable && (
            <div className="w-56">
              <SelectField label="" value={s.status} onChange={(x) => run(updateSession, { id: s.id, patch: { status: x as TrainingSession["status"] } })} options={optionsOf("session")} />
            </div>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Inscrits", `${s.participants.length} / ${s.capacity}`],
          ["Places restantes", Math.max(0, s.capacity - s.participants.length)],
          ["Tarif", formatXOF(s.price)],
          ["Statut", <StatusBadge key="s" kind="session" value={s.status} />],
        ].map(([l, v], i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">{l}</p>
            <div className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{v}</div>
          </div>
        ))}
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: "participants", label: "Participants", count: s.participants.length }, { key: "presence", label: "Présences" }, { key: "payments", label: "Payeurs et paiements" }, { key: "info", label: "Informations" }, { key: "history", label: "Historique" }]} />

      {tab === "participants" && (
        <ComponentCard title="Participants" desc="Le participant est distinct du client payeur">
          {editable && s.status !== "terminee" && s.status !== "annulee" && (
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_10rem_1fr_auto]">
              <TextField label="Nom du participant" value={p.name} onChange={(name) => setP({ ...p, name })} />
              <TextField label="Téléphone" value={p.phone} onChange={(phone) => setP({ ...p, phone })} />
              <SelectField label="Client payeur" value={p.payerClientId} onChange={(payerClientId) => setP({ ...p, payerClientId })} options={opts.clients} />
              <Button size="sm" variant={full ? "danger" : "primary"} disabled={!p.name.trim() || !p.payerClientId} onClick={register}>{full ? "Capacité atteinte" : "Inscrire"}</Button>
            </div>
          )}
          {full && <DemoNotice tone="warning">Capacité maximale atteinte : toute tentative d&apos;inscription supplémentaire est refusée et signalée.</DemoNotice>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {s.participants.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <strong>{x.name}</strong> · {x.phone}
                  <span className="block text-theme-xs text-gray-500">Payeur : {clientName(db, x.payerClientId)} {x.invoiceId && "· facturé"}</span>
                </span>
                {editable && !x.invoiceId && (
                  <Button size="xs" variant="ghost" onClick={() => run(removeParticipant, { sessionId: s.id, participantId: x.id })} title="Retirer">
                    <TrashBinIcon className="size-4" />
                  </Button>
                )}
              </li>
            ))}
            {!s.participants.length && <li className="py-3 text-sm text-gray-500">Aucun inscrit.</li>}
          </ul>
        </ComponentCard>
      )}

      {tab === "presence" && (
        <ComponentCard title="Feuille de présence">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-theme-xs text-gray-500">
                  <th className="py-2 text-start">Participant</th>
                  {dates.map((d) => <th key={d} className="px-2 py-2 text-center">{formatDate(d)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {s.participants.map((x) => (
                  <tr key={x.id}>
                    <td className="py-2">{x.name}</td>
                    {dates.map((d) => (
                      <td key={d} className="px-2 py-2 text-center">
                        <input type="checkbox" checked={!!x.attendance[d]} disabled={!editable} onChange={() => run(toggleAttendance, { sessionId: s.id, participantId: x.id, date: d }, { silent: true })} className="size-4 rounded text-brand-500" aria-label={`Présence ${x.name} ${d}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ComponentCard>
      )}

      {tab === "payments" && (
        <ComponentCard title="Facturation par payeur" desc="Les paiements passent par le module financier commun (aucune double comptabilisation)">
          {payers.length === 0 && <p className="text-sm text-gray-500">Aucun payeur.</p>}
          {payers.map((payer) => {
            const parts = s.participants.filter((x) => x.payerClientId === payer);
            const invIds = Array.from(new Set(parts.map((x) => x.invoiceId).filter(Boolean))) as string[];
            const unbilled = parts.filter((x) => !x.invoiceId).length;
            return (
              <div key={payer} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-800">
                <span>
                  <strong>{clientName(db, payer)}</strong> — {parts.length} participant(s)
                  {invIds.map((iid) => {
                    const inv = db.invoices.find((i) => i.id === iid);
                    return inv ? <Link key={iid} href={`/facturation/factures/${iid}`} className="ms-2 text-brand-600 hover:underline">{inv.code} (solde {formatXOF(invoiceBalance(db, inv))})</Link> : null;
                  })}
                </span>
                {unbilled > 0 && can("facturation", "create") && (
                  <Button size="xs" onClick={() => { const r = run(invoiceSessionPayer, { sessionId: s.id, payerClientId: payer }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>
                    Facturer {unbilled} participant(s)
                  </Button>
                )}
              </div>
            );
          })}
        </ComponentCard>
      )}

      {tab === "info" && (
        <ComponentCard title="Informations">
          <InfoGrid items={[{ label: "Formation", value: db.trainings.find((t) => t.id === s.trainingId)?.title }, { label: "Modalité", value: s.modality }, { label: "Lieu", value: s.location }, { label: "Intervenants", value: s.trainers.join(", ") }, { label: "Description", value: s.description, wide: true }]} />
        </ComponentCard>
      )}

      {tab === "history" && (
        <ComponentCard title="Historique">
          <EntityHistory items={s.history.map((h) => ({ date: h.date, label: h.action, userId: h.userId }))} auditTargets={[s.code]} />
        </ComponentCard>
      )}
    </div>
  );
}
