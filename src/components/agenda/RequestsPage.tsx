"use client";

import ActivityIcon from "@/components/common/ActivityIcon";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { CheckField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { apptKind } from "@/lib/activityKinds";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatDateLong, formatDateTime, formatTime } from "@/lib/format";
import { decideAppointmentRequest, findConflicts, saveApptApproval } from "@/lib/services/appointmentsService";
import type { Appointment } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

/** La journée du praticien autour du créneau demandé : on voit tout de suite s'il est libre. */
function DayStrip({ a }: { a: Appointment }) {
  const { db } = useDemo();
  const day = a.start.slice(0, 10);
  const list = db.appointments.filter((x) => x.id !== a.id && x.practitionerId === a.practitionerId && x.start.slice(0, 10) === day && x.status !== "annule").sort((x, y) => x.start.localeCompare(y.start));
  const s = new Date(a.start).getTime();
  const e = s + a.durationMin * 60000;
  return (
    <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
      <p className="mb-2 text-theme-xs font-medium text-gray-500">Votre journée du {formatDateLong(day)}</p>
      {list.length === 0 ? (
        <p className="text-theme-sm text-success-700 dark:text-success-400">Aucun autre rendez-vous ce jour-là : vous êtes libre.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((x) => {
            const xs = new Date(x.start).getTime();
            const clash = xs < e && s < xs + x.durationMin * 60000;
            return (
              <li key={x.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-theme-sm", clash ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : "text-gray-700 dark:text-gray-300")}>
                <span className="w-28 shrink-0 whitespace-nowrap tabular-nums">{formatTime(x.start)} · {x.durationMin} min</span>
                <ActivityIcon kind={apptKind(x)} />
                <span className="min-w-0 flex-1 truncate">{x.reason} — {clientName(db, x.clientId)}</span>
                {clash && <span className="shrink-0 text-[11px] font-semibold">CHEVAUCHE</span>}
                {x.status === "demande" && <span className="shrink-0 text-[11px] text-warning-600">à valider</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RequestCard({ a }: { a: Appointment }) {
  const { db, run } = useDemo();
  const [mode, setMode] = useState<null | "deplace" | "refuse">(null);
  const [note, setNote] = useState("");
  const [start, setStart] = useState(a.start.slice(0, 16));
  const busy = findConflicts(db, a, a.id).filter((c) => c.kind !== "ressource");
  const decide = (decision: "accepte" | "deplace" | "refuse", force = false) => run(decideAppointmentRequest, { id: a.id, decision, note, newStart: decision === "deplace" ? start : undefined, force });
  const input = "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";
  return (
    <li className="cliva-rise space-y-3 rounded-3xl border border-warning-200 bg-white p-5 shadow-cliva dark:border-warning-500/30 dark:bg-white/3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatDateTime(a.start)} <span className="text-sm font-normal text-gray-500">· {a.durationMin} min</span></p>
          <p className="text-sm text-gray-800 dark:text-white/90">{a.reason}</p>
          <p className="text-theme-sm text-gray-500">{clientName(db, a.clientId)}{a.patientId && ` · ${patientName(db, a.patientId)}`} · pour {userName(db, a.practitionerId)}</p>
        </div>
        <p className="text-end text-theme-xs text-gray-500">Demandé par <strong>{userName(db, a.request?.requestedById)}</strong><br />{a.request && formatDateTime(a.request.requestedAt)}</p>
      </div>
      {a.request?.note && <p className="rounded-xl bg-brand-50 px-3 py-2 text-theme-sm text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">« {a.request.note} »</p>}
      <DayStrip a={a} />
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decide("accepte", busy.length > 0)} className={busy.length ? "bg-warning-500 hover:bg-warning-600" : ""}>{busy.length ? "Accepter quand même" : "Accepter"}</Button>
          <Button variant="outline" onClick={() => setMode("deplace")}>Proposer un autre horaire</Button>
          <Button variant="outline" className="text-error-600" onClick={() => setMode("refuse")}>Refuser</Button>
        </div>
      )}
      {mode === "deplace" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Nouvel horaire<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={cn(input, "mt-1")} /></label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message au collaborateur (facultatif)" className={input} aria-label="Message" />
          <div className="flex gap-2"><Button onClick={() => decide("deplace")}>Valider ce nouvel horaire</Button><Button variant="ghost" onClick={() => setMode(null)}>Retour</Button></div>
        </div>
      )}
      {mode === "refuse" && (
        <div className="space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif du refus (obligatoire), ex. : je suis en mission ce jour-là" className={input} aria-label="Motif du refus" />
          <div className="flex gap-2"><Button className="bg-error-500 hover:bg-error-600" onClick={() => decide("refuse")} disabled={!note.trim()}>Refuser la demande</Button><Button variant="ghost" onClick={() => setMode(null)}>Retour</Button></div>
        </div>
      )}
    </li>
  );
}

function ApprovalSettings() {
  const { db, run } = useDemo();
  const cur = db.settings.apptApproval ?? { enabled: false, practitionerIds: [] };
  const vets = db.users.filter((u) => u.active && (u.roleId === "dg" || u.roleId === "vet"));
  const toggle = (id: string) => run(saveApptApproval, { enabled: cur.enabled, practitionerIds: cur.practitionerIds.includes(id) ? cur.practitionerIds.filter((x) => x !== id) : [...cur.practitionerIds, id] }, { silent: true });
  return (
    <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Réglage</h3>
      <div className="mt-3 space-y-3">
        <CheckField label="Les RDV pris par les collaborateurs doivent être validés" checked={cur.enabled} onChange={(x) => run(saveApptApproval, { enabled: x, practitionerIds: cur.practitionerIds })} />
        {cur.enabled && (
          <div>
            <p className="mb-1.5 text-theme-sm text-gray-600 dark:text-gray-400">Agendas concernés :</p>
            <div className="flex flex-wrap gap-2">
              {vets.map((u) => (
                <button key={u.id} type="button" aria-pressed={cur.practitionerIds.includes(u.id)} onClick={() => toggle(u.id)} className={cn("rounded-full border px-3 py-1.5 text-sm", cur.practitionerIds.includes(u.id) ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function RequestsPage() {
  const { db, user } = useDemo();
  const [tab, setTab] = useState<"attente" | "traitees">("attente");
  const isDG = user?.roleId === "dg";
  const mine = (a: Appointment) => isDG || a.practitionerId === user?.id || a.request?.requestedById === user?.id;
  const all = db.appointments.filter((a) => a.request && mine(a));
  const pending = all.filter((a) => a.status === "demande").sort((a, b) => a.start.localeCompare(b.start));
  const done = all.filter((a) => a.status !== "demande").sort((a, b) => (b.request?.decidedAt ?? "").localeCompare(a.request?.decidedAt ?? ""));
  const canDecide = (a: Appointment) => isDG || a.practitionerId === user?.id;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Demandes de rendez-vous" subtitle="Les RDV pris par l'équipe pour votre agenda attendent votre accord" trail={[{ label: "Agenda", href: "/agenda" }]} />
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
        {(["attente", "traitees"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === t ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
            {t === "attente" ? `À valider (${pending.length})` : `Traitées (${done.length})`}
          </button>
        ))}
      </div>
      {tab === "attente" ? (
        <>
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {pending.map((a) =>
              canDecide(a) ? (
                <RequestCard key={a.id} a={a} />
              ) : (
                <li key={a.id} className="rounded-3xl border border-gray-200/70 bg-white p-5 text-sm shadow-cliva dark:border-gray-800 dark:bg-white/3">
                  <p className="font-semibold text-gray-800 dark:text-white/90">{formatDateTime(a.start)} — {a.reason}</p>
                  <p className="text-gray-500">{clientName(db, a.clientId)} · en attente de {userName(db, a.practitionerId)}</p>
                </li>
              ),
            )}
          </ul>
          {!pending.length && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucune demande en attente.</p>}
        </>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:divide-gray-800 dark:border-gray-800 dark:bg-white/3">
          {done.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span className="text-gray-800 dark:text-white/90">{formatDateTime(a.start)} — {a.reason} <span className="text-gray-500">· {clientName(db, a.clientId)}</span></span>
              <span className={cn("rounded-full px-2 py-0.5 text-theme-xs font-medium", a.request?.decision === "refuse" ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300")}>
                {a.request?.decision === "refuse" ? "Refusée" : a.request?.decision === "deplace" ? "Acceptée (autre horaire)" : "Acceptée"} par {userName(db, a.request?.decidedById)}
              </span>
            </li>
          ))}
          {!done.length && <li className="px-5 py-8 text-center text-sm text-gray-500">Rien pour l&apos;instant.</li>}
        </ul>
      )}
      {isDG && <ApprovalSettings />}
    </div>
  );
}
