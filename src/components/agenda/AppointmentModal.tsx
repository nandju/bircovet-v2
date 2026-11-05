"use client";
import ActivityIcon from "@/components/common/ActivityIcon";
import { ACTIVITY_KINDS, kindFromText } from "@/lib/activityKinds";
import { cn } from "@/utils";

import AppModal from "@/components/common/AppModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import StatusBadge from "@/components/common/StatusBadge";
import { CheckField, FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { userName } from "@/lib/calc";
import { formatDateTime } from "@/lib/format";
import {
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  needsApproval,
  findConflicts,
  simulateReminder,
  updateAppointment,
  type AppointmentInput,
} from "@/lib/services/appointmentsService";
import type { Appointment } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment;
  defaultStart?: string;
}

export default function AppointmentModal({ isOpen, onClose, appointment, defaultStart }: Props) {
  const { db, run, establishment, can, user } = useDemo();
  const opts = useOptions();
  const cancel = useModal();
  const [v, setV] = useState<AppointmentInput | null>(null);
  const [force, setForce] = useState(false);
  const [moveReason, setMoveReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen || !establishment) return;
    setForce(false);
    setMoveReason("");
    setNote("");
    setV(
      appointment
        ? { establishmentId: appointment.establishmentId, clientId: appointment.clientId, patientId: appointment.patientId, practitionerId: appointment.practitionerId, start: appointment.start, durationMin: appointment.durationMin, reason: appointment.reason, resource: appointment.resource, reminder: { ...appointment.reminder }, kind: appointment.kind }
        : {
            establishmentId: establishment.id,
            clientId: "",
            patientId: "",
            practitionerId: "",
            start: defaultStart ?? "",
            durationMin: establishment.slotMinutes,
            reason: "",
            resource: "",
            reminder: { enabled: true, channel: db.settings.reminderDefaultChannel, offsetHours: db.settings.reminderDefaultHours },
          },
    );
  }, [isOpen, appointment, defaultStart, establishment, db.settings]);

  const conflicts = useMemo(() => (v && v.start && v.practitionerId ? findConflicts(db, v, appointment?.id) : []), [db, v, appointment]);
  if (!v) return null;
  const est = db.establishments.find((e) => e.id === v.establishmentId);
  const locked = appointment && (appointment.status === "annule" || appointment.status === "honore");
  const editable = can("agenda", appointment ? "update" : "create") && !locked;
  const set = <K extends keyof AppointmentInput>(k: K, x: AppointmentInput[K]) => setV((s) => (s ? { ...s, [k]: x } : s));
  const moved = appointment && (appointment.start !== v.start || appointment.practitionerId !== v.practitionerId);
  const ask = !appointment && !!v.practitionerId && !!user && needsApproval(db, v.practitionerId, user.id, user.roleId);

  const save = () => {
    const input = { ...v, patientId: v.patientId || undefined };
    const r = appointment ? run(updateAppointment, { id: appointment.id, input, reason: moveReason, force }) : run(createAppointment, { input, force, note });
    if (r.ok) onClose();
  };

  return (
    <>
      <AppModal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={appointment ? "Rendez-vous" : "Nouveau rendez-vous"}
        description={appointment ? `${formatDateTime(appointment.start)} · ${userName(db, appointment.practitionerId)}` : undefined}
        footer={
          <>
            {appointment && !locked && can("agenda", "update") && (
              <>
                <Button size="sm" variant="ghost" className="text-error-600" onClick={cancel.openModal}>
                  Annuler le RDV
                </Button>
                {appointment.status === "planifie" && (
                  <Button size="sm" variant="outline" onClick={() => run(confirmAppointment, { id: appointment.id }).ok && onClose()}>
                    Marquer confirmé
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => run(simulateReminder, { id: appointment.id })} disabled={!appointment.reminder.enabled}>
                  Simuler le rappel
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {editable && (
              <Button size="sm" onClick={save} disabled={(conflicts.length > 0 && !force && !ask) || !v.clientId || !v.practitionerId || !v.start || !v.reason.trim()}>
                {appointment ? (moved ? "Déplacer" : "Enregistrer") : ask ? "Envoyer la demande" : "Créer"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {ask && (
            <div className="space-y-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2.5 text-theme-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              <p><strong>Ce rendez-vous sera soumis à l&apos;accord de {userName(db, v.practitionerId)}.</strong> Dites au client que vous le rappelez pour confirmer.</p>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message pour le praticien (facultatif) : urgence, préférence du client…" aria-label="Message pour le praticien" className="h-9 w-full rounded-lg border border-warning-200 bg-white px-3 text-sm text-gray-800 dark:border-warning-500/30 dark:bg-gray-900 dark:text-white/90" />
            </div>
          )}
          {appointment?.request && (
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-theme-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
              Demandé par {userName(db, appointment.request.requestedById)} le {formatDateTime(appointment.request.requestedAt)}
              {appointment.request.note && ` — « ${appointment.request.note} »`}
              {appointment.request.decision && ` · ${appointment.request.decision === "refuse" ? "refusé" : "accepté"} par ${userName(db, appointment.request.decidedById)}`}
            </p>
          )}
          {appointment && (
            <div className="flex flex-wrap gap-2">
              <StatusBadge kind="appointment" value={appointment.status} />
              <StatusBadge kind="queue" value={appointment.queueStatus} />
              {appointment.cancelReason && <span className="text-sm text-gray-500">Motif : {appointment.cancelReason}</span>}
            </div>
          )}
          <FormGrid>
            <SelectField label="Client" required value={v.clientId} onChange={(x) => setV({ ...v, clientId: x, patientId: "" })} options={opts.clients} disabled={!editable || !!appointment} />
            <SelectField label="Patient" value={v.patientId ?? ""} onChange={(x) => set("patientId", x)} options={opts.patientsOf(v.clientId)} disabled={!editable || !v.clientId} allowEmpty placeholder="(non précisé)" />
            <SelectField label="Intervenant" required value={v.practitionerId} onChange={(x) => set("practitionerId", x)} options={opts.staff} disabled={!editable} />
            <SelectField label="Établissement" value={v.establishmentId} onChange={(x) => set("establishmentId", x)} options={opts.establishments} disabled={!editable} />
            <TextField label="Date et heure" required type="datetime-local" value={v.start} onChange={(x) => set("start", x)} disabled={!editable} />
            <NumberField label="Durée du créneau" suffix="min" value={v.durationMin} onChange={(x) => set("durationMin", x)} min={5} step={5} disabled={!editable} hint={`Créneau par défaut de l'établissement : ${est?.slotMinutes ?? 30} min (paramétrable)`} />
            <TextField label="Motif" required value={v.reason} onChange={(x) => set("reason", x)} disabled={!editable} />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Type d&apos;activité <span className="font-normal text-gray-500">(icône dans l&apos;agenda)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_KINDS.filter((k) => k.key !== "mission" && k.key !== "rapport").map((k) => {
                  const on = (v.kind ?? kindFromText(v.reason)) === k.key;
                  return (
                    <button key={k.key} type="button" disabled={!editable} aria-pressed={on} onClick={() => set("kind", k.key)} className={cn("cliva-press inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-theme-xs", on ? "border-gray-800 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                      <ActivityIcon kind={k.key} className={on ? "!text-current" : ""} />
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <SelectField label="Ressource" value={v.resource} onChange={(x) => set("resource", x)} options={(est?.resources ?? []).map((r) => ({ value: r, label: r }))} allowEmpty placeholder="Aucune" disabled={!editable} />
          </FormGrid>
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <CheckField label="Rappel au client (simulé — aucun envoi réel)" checked={v.reminder.enabled} onChange={(x) => set("reminder", { ...v.reminder, enabled: x })} disabled={!editable} />
            {v.reminder.enabled && (
              <FormGrid className="mt-3">
                <SelectField label="Canal" value={v.reminder.channel} onChange={(x) => set("reminder", { ...v.reminder, channel: x as typeof v.reminder.channel })} options={[{ value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "E-mail" }, { value: "appel", label: "Appel" }]} disabled={!editable} />
                <NumberField label="Délai avant le RDV" suffix="h" value={v.reminder.offsetHours} onChange={(x) => set("reminder", { ...v.reminder, offsetHours: x })} min={1} disabled={!editable} />
              </FormGrid>
            )}
            {appointment?.reminder.simulatedAt && <p className="mt-2 text-theme-xs text-gray-500">Dernier rappel simulé : {formatDateTime(appointment.reminder.simulatedAt)}</p>}
          </div>
          {moved && <TextField label="Motif du déplacement" value={moveReason} onChange={setMoveReason} />}
          {conflicts.length > 0 && editable && (
            <DemoNotice tone="warning">
              <p className="font-medium">Conflit de créneau détecté :</p>
              <ul className="list-disc ps-5">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.label}</li>
                ))}
              </ul>
              <div className="mt-2">
                <CheckField label="J'ai vérifié : enregistrer malgré le conflit" checked={force} onChange={setForce} />
              </div>
            </DemoNotice>
          )}
          {appointment && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 dark:text-gray-400">Historique du rendez-vous ({appointment.history.length})</summary>
              <ul className="mt-2 space-y-1">
                {appointment.history.map((h, i) => (
                  <li key={i} className="text-theme-xs text-gray-500">
                    {formatDateTime(h.date)} — {h.action} ({userName(db, h.userId)})
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </AppModal>
      {appointment && (
        <ConfirmDialog
          isOpen={cancel.isOpen}
          onClose={cancel.closeModal}
          title="Annuler le rendez-vous"
          tone="danger"
          message="Le rendez-vous restera visible dans l'historique avec son motif d'annulation."
          reasonLabel="Motif d'annulation"
          confirmLabel="Annuler le rendez-vous"
          onConfirm={(reason) => {
            const ok = run(cancelAppointment, { id: appointment.id, reason }).ok;
            if (ok) onClose();
            return ok;
          }}
        />
      )}
    </>
  );
}
