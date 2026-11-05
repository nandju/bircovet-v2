"use client";

import ActivityIcon from "@/components/common/ActivityIcon";
import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import QuickRegisterModal from "@/components/patients/QuickRegisterModal";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useNow } from "@/hooks/useNow";
import { useOptions } from "@/hooks/useOptions";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatDateTime, formatTime, formatXOF } from "@/lib/format";
import { createAppointment, markHomeVisit } from "@/lib/services/appointmentsService";
import type { Appointment, HomeVisit } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const FEE = { urgence: 10_000, demande: 5_000 };

type Form = { clientId: string; patientId: string; practitionerId: string; start: string; durationMin: number; reason: string; kind: HomeVisit["reason"]; address: string; mapsUrl: string; phone: string; travelFee: number };

const mapsFor = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Côte d'Ivoire`)}`;

function NewHomeVisit({ isOpen, onClose, now }: { isOpen: boolean; onClose: () => void; now: string }) {
  const { db, run, establishment } = useDemo();
  const opts = useOptions();
  const quick = useModal();
  const blank = (): Form => ({ clientId: "", patientId: "", practitionerId: "", start: now.slice(0, 16), durationMin: 60, reason: "", kind: "urgence", address: "", mapsUrl: "", phone: "", travelFee: FEE.urgence });
  const [v, setV] = useState<Form>(blank);
  const pickClient = (id: string) => {
    const c = db.clients.find((x) => x.id === id);
    setV((s) => ({ ...s, clientId: id, patientId: "", address: c ? [c.address, c.city].filter(Boolean).join(", ") : "", phone: c?.phone ?? "" }));
  };
  const close = () => {
    setV(blank());
    onClose();
  };
  const save = () => {
    if (!establishment) return;
    const home: HomeVisit = { reason: v.kind, address: v.address.trim(), mapsUrl: v.mapsUrl.trim() || (v.address.trim() ? mapsFor(v.address.trim()) : undefined), travelFee: v.travelFee, contactPhone: v.phone.trim() || undefined };
    const r = run(createAppointment, {
      input: {
        establishmentId: establishment.id,
        clientId: v.clientId,
        patientId: v.patientId || undefined,
        practitionerId: v.practitionerId,
        start: v.start,
        durationMin: v.durationMin,
        reason: `${v.kind === "urgence" ? "Urgence à domicile" : "Consultation à domicile"} — ${v.reason.trim()}`,
        resource: "",
        reminder: { enabled: v.kind === "demande", channel: db.settings.reminderDefaultChannel, offsetHours: 2 },
        kind: "domicile",
        home,
      },
      force: v.kind === "urgence",
    });
    if (r.ok) close();
  };
  return (
    <>
      <AppModal
        isOpen={isOpen && !quick.isOpen}
        onClose={close}
        size="lg"
        title="Nouvelle visite à domicile"
        description="Urgence ou visite programmée à la demande du client. Elle apparaît dans l'agenda avec l'icône « domicile »."
        footer={
          <>
            <Button size="sm" variant="outline" onClick={close}>Annuler</Button>
            <Button size="sm" onClick={save} disabled={!v.clientId || !v.practitionerId || !v.start || !v.reason.trim() || !v.address.trim()}>Planifier la visite</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
            {(["urgence", "demande"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => setV({ ...v, kind: k, travelFee: FEE[k] })} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", v.kind === k ? (k === "urgence" ? "bg-error-500 text-white" : "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white") : "text-gray-500")}>
                {k === "urgence" ? "Urgence" : "À la demande du client"}
              </button>
            ))}
          </div>
          <FormGrid>
            <div className="sm:col-span-2">
              <SelectField label="Client" required value={v.clientId} onChange={pickClient} options={opts.clients} placeholder="Choisir un client" />
              <button type="button" className="mt-1 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={quick.openModal}>
                Nouveau client ? Enregistrement rapide (propriétaire + animal)
              </button>
            </div>
            <SelectField label="Patient" value={v.patientId} onChange={(x) => setV({ ...v, patientId: x })} options={opts.patientsOf(v.clientId)} allowEmpty placeholder={v.clientId ? "Choisir l'animal" : "Choisir d'abord le client"} disabled={!v.clientId} />
            <SelectField label="Vétérinaire" required value={v.practitionerId} onChange={(x) => setV({ ...v, practitionerId: x })} options={opts.staff} />
            <TextField label="Date et heure" required type="datetime-local" value={v.start} onChange={(x) => setV({ ...v, start: x })} />
            <NumberField label="Durée prévue" suffix="min" value={v.durationMin} onChange={(x) => setV({ ...v, durationMin: x })} min={15} step={15} />
            <TextField label="Motif" required value={v.reason} onChange={(x) => setV({ ...v, reason: x })} placeholder="Ex. : chienne en dystocie, vaccination de la portée…" className="sm:col-span-2" />
            <TextAreaField label="Adresse de la visite" value={v.address} onChange={(x) => setV({ ...v, address: x })} rows={2} className="sm:col-span-2" />
            <TextField label="Lien Google Maps (facultatif)" value={v.mapsUrl} onChange={(x) => setV({ ...v, mapsUrl: x })} placeholder="Collez le lien partagé par le client" />
            <TextField label="Téléphone sur place" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
            <NumberField label="Frais de déplacement" suffix="FCFA" value={v.travelFee} onChange={(x) => setV({ ...v, travelFee: x })} min={0} step={1000} />
          </FormGrid>
          {v.kind === "urgence" && <p className="text-theme-xs text-gray-500">Une urgence est planifiée même si le vétérinaire a déjà un rendez-vous sur ce créneau.</p>}
        </div>
      </AppModal>
      <QuickRegisterModal
        isOpen={quick.isOpen}
        onClose={quick.closeModal}
        submitLabel="Enregistrer et revenir à la visite"
        onDone={(r) => {
          quick.closeModal();
          pickClient(r.clientId);
          setV((s) => ({ ...s, patientId: r.patientId }));
        }}
      />
    </>
  );
}

function VisitCard({ a, onStart }: { a: Appointment; onStart: () => void }) {
  const { db, run } = useDemo();
  const h = a.home!;
  const done = !!a.consultationId || a.status === "honore";
  const cancelled = a.status === "annule" || a.status === "absent";
  return (
    <li className={cn("cliva-rise rounded-3xl border bg-white p-4 shadow-cliva dark:bg-white/3", h.reason === "urgence" && !done && !cancelled ? "border-error-200 dark:border-error-500/30" : "border-gray-200/70 dark:border-gray-800")}>
      <div className="flex items-start gap-3">
        <ActivityIcon kind="domicile" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", h.reason === "urgence" ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300")}>{h.reason === "urgence" ? "Urgence" : "À la demande"}</span>
            <span className="text-theme-xs text-gray-500">{formatDateTime(a.start)} · {userName(db, a.practitionerId)}</span>
            {done && <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-500/15 dark:text-success-300">Consultation faite</span>}
            {cancelled && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-400">Annulée</span>}
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {clientName(db, a.clientId)}
            {a.patientId && <span className="font-normal text-gray-500"> · {patientName(db, a.patientId)}</span>}
          </p>
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">{a.reason}</p>
          <p className="text-theme-xs text-gray-500">
            {h.address}
            {h.contactPhone && <> · <a className="text-brand-600 hover:underline dark:text-brand-400" href={`tel:${h.contactPhone.replace(/\s/g, "")}`}>{h.contactPhone}</a></>}
            {" · "}déplacement {formatXOF(h.travelFee)}
          </p>
          {(h.departedAt || h.arrivedAt) && (
            <p className="text-theme-xs text-gray-500">
              {h.departedAt && <>Départ {formatTime(h.departedAt)}</>}
              {h.departedAt && h.arrivedAt && " · "}
              {h.arrivedAt && <>Arrivée {formatTime(h.arrivedAt)}</>}
            </p>
          )}
          {!cancelled && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {h.mapsUrl && (
                <a href={h.mapsUrl} target="_blank" rel="noreferrer" className="cliva-press inline-flex h-7 items-center rounded-lg border border-gray-300 px-2.5 text-theme-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  Itinéraire
                </a>
              )}
              {!done && !h.departedAt && <Button size="xs" variant="soft" onClick={() => run(markHomeVisit, { id: a.id, step: "depart" })}>Départ</Button>}
              {!done && h.departedAt && !h.arrivedAt && <Button size="xs" variant="soft" onClick={() => run(markHomeVisit, { id: a.id, step: "arrivee" })}>Arrivée sur place</Button>}
              {!done && <Button size="xs" onClick={onStart}>Démarrer la consultation</Button>}
              {a.consultationId && <Button size="xs" variant="ghost" onClick={onStart}>Voir la consultation</Button>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default function HomeVisitsPage() {
  const { db } = useDemo();
  const router = useRouter();
  const now = useNow();
  const create = useModal();
  const [tab, setTab] = useState<"avenir" | "passees">("avenir");
  const visits = db.appointments.filter((a) => a.home);
  const day = now.slice(0, 10);
  const open = (a: Appointment) => (a.consultationId ? false : a.status !== "annule" && a.status !== "absent" && a.status !== "honore");
  const upcoming = visits.filter((a) => open(a) || a.start.slice(0, 10) >= day).sort((a, b) => (a.home!.reason === b.home!.reason ? a.start.localeCompare(b.start) : a.home!.reason === "urgence" ? -1 : 1));
  const past = visits.filter((a) => !upcoming.includes(a)).sort((a, b) => b.start.localeCompare(a.start));
  const month = visits.filter((a) => a.start.slice(0, 7) === day.slice(0, 7) && a.status !== "annule");
  const list = tab === "avenir" ? upcoming : past;
  const start = (a: Appointment) => router.push(a.consultationId ? `/consultations/${a.consultationId}` : `/consultations/nouvelle?rdv=${a.id}`);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Consultations à domicile"
        subtitle="Urgences et visites à la demande des clients (animaux de compagnie)"
        trail={[{ label: "Consultations", href: "/consultations" }]}
        actions={<Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>Nouvelle visite à domicile</Button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["À venir / en cours", String(upcoming.length)],
          ["Urgences ce mois", String(month.filter((a) => a.home!.reason === "urgence").length)],
          ["Visites ce mois", String(month.length)],
          ["Frais de déplacement ce mois", formatXOF(month.reduce((s, a) => s + a.home!.travelFee, 0))],
        ].map(([l, val]) => (
          <div key={l} className="rounded-2xl border border-gray-200/70 bg-white p-3 shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">{l}</p>
            <p className="mt-1 text-lg font-semibold text-gray-800 tabular-nums dark:text-white/90">{val}</p>
          </div>
        ))}
      </div>
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
        {(["avenir", "passees"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === t ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
            {t === "avenir" ? `À venir (${upcoming.length})` : `Historique (${past.length})`}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((a) => <VisitCard key={a.id} a={a} onStart={() => start(a)} />)}
      </ul>
      {list.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">{tab === "avenir" ? "Aucune visite à domicile prévue." : "Aucune visite passée."}</p>}
      <NewHomeVisit isOpen={create.isOpen} onClose={create.closeModal} now={now} />
    </div>
  );
}
