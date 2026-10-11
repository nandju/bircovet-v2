"use client";

import AppModal from "@/components/common/AppModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { clientOutstanding } from "@/lib/calc";
import { formatXOF, isoLocal } from "@/lib/format";
import { addVaccination, addVital, declareDeath, transferOwnership } from "@/lib/services/patientsService";
import type { Patient } from "@/lib/types";
import { useEffect, useState } from "react";

const Footer = ({ onClose, onSave, disabled, label = "Enregistrer" }: { onClose: () => void; onSave: () => void; disabled?: boolean; label?: string }) => (
  <>
    <Button variant="outline" size="sm" onClick={onClose}>
      Annuler
    </Button>
    <Button size="sm" onClick={onSave} disabled={disabled}>
      {label}
    </Button>
  </>
);

export function VitalModal({ patient, isOpen, onClose }: { patient: Patient; isOpen: boolean; onClose: () => void }) {
  const { run } = useDemo();
  const [v, setV] = useState({ date: "", weightKg: NaN, temperature: NaN, heartRate: NaN, respRate: NaN });
  useEffect(() => {
    if (isOpen) setV({ date: isoLocal(), weightKg: NaN, temperature: NaN, heartRate: NaN, respRate: NaN });
  }, [isOpen]);
  const opt = (n: number) => (Number.isFinite(n) ? n : undefined);
  const save = () => run(addVital, { patientId: patient.id, vital: { date: v.date, weightKg: v.weightKg, temperature: opt(v.temperature), heartRate: opt(v.heartRate), respRate: opt(v.respRate) } }).ok && onClose();
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Enregistrer des constantes" description="Les constantes sont datées et attribuées à l'utilisateur connecté." footer={<Footer onClose={onClose} onSave={save} disabled={!(v.weightKg > 0)} />}>
      <FormGrid>
        <TextField label="Date et heure" type="datetime-local" value={v.date} onChange={(x) => setV({ ...v, date: x })} />
        <NumberField label="Poids" required suffix="kg" value={v.weightKg} onChange={(x) => setV({ ...v, weightKg: x })} min={0} step={0.1} />
        <NumberField label="Température" suffix="°C" value={v.temperature} onChange={(x) => setV({ ...v, temperature: x })} step={0.1} />
        <NumberField label="Fréquence cardiaque" suffix="bpm" value={v.heartRate} onChange={(x) => setV({ ...v, heartRate: x })} />
        <NumberField label="Fréquence respiratoire" suffix="/min" value={v.respRate} onChange={(x) => setV({ ...v, respRate: x })} />
      </FormGrid>
    </AppModal>
  );
}

export function VaccinationModal({ patient, isOpen, onClose }: { patient: Patient; isOpen: boolean; onClose: () => void }) {
  const { run, db } = useDemo();
  const [v, setV] = useState({ name: "", date: "", nextDue: "", lotRef: "" });
  useEffect(() => {
    if (isOpen) setV({ name: "", date: isoLocal().slice(0, 10), nextDue: "", lotRef: "" });
  }, [isOpen]);
  const save = () => run(addVaccination, { patientId: patient.id, vac: { name: v.name, date: v.date, nextDue: v.nextDue || undefined, lotRef: v.lotRef || undefined } }).ok && onClose();
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Vaccination et rappel" footer={<Footer onClose={onClose} onSave={save} disabled={!v.name.trim()} />}>
      <div className="space-y-4">
        <DemoNotice>{db.settings.vaccineReminderNote}</DemoNotice>
        <FormGrid>
          <SelectField label="Vaccin" required value={v.name} onChange={(x) => setV({ ...v, name: x })} options={db.products.filter((p) => p.category === "vaccin").map((p) => ({ value: p.name, label: p.name }))} />
          <TextField label="Référence de lot" value={v.lotRef} onChange={(x) => setV({ ...v, lotRef: x })} />
          <TextField label="Date d'administration" type="date" value={v.date} onChange={(x) => setV({ ...v, date: x })} />
          <TextField label="Prochain rappel (saisi par le vétérinaire)" type="date" value={v.nextDue} onChange={(x) => setV({ ...v, nextDue: x })} hint="Laisser vide si aucun rappel" />
        </FormGrid>
      </div>
    </AppModal>
  );
}

export function TransferModal({ patient, isOpen, onClose }: { patient: Patient; isOpen: boolean; onClose: () => void }) {
  const { run, db } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState({ newOwnerId: "", reason: "", date: "" });
  useEffect(() => {
    if (isOpen) setV({ newOwnerId: "", reason: "", date: isoLocal().slice(0, 10) });
  }, [isOpen]);
  const debt = clientOutstanding(db, patient.ownerId);
  const save = () => run(transferOwnership, { patientId: patient.id, ...v }).ok && onClose();
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Cession de propriété" footer={<Footer onClose={onClose} onSave={save} disabled={!v.newOwnerId || !v.reason.trim()} label="Enregistrer la cession" />}>
      <div className="space-y-4">
        <DemoNotice tone="warning">
          L&apos;historique des propriétaires est conservé. {debt > 0 ? `L'ancien propriétaire conserve ses impayés (${formatXOF(debt)}) : ` : ""}les dettes antérieures ne sont jamais transférées automatiquement au nouveau propriétaire.
        </DemoNotice>
        <SelectField label="Nouveau propriétaire" required value={v.newOwnerId} onChange={(x) => setV({ ...v, newOwnerId: x })} options={opts.clients.filter((o) => o.value !== patient.ownerId)} />
        <TextField label="Date de cession" type="date" value={v.date} onChange={(x) => setV({ ...v, date: x })} />
        <TextAreaField label="Motif" required value={v.reason} onChange={(x) => setV({ ...v, reason: x })} rows={2} />
      </div>
    </AppModal>
  );
}

export function DeathDialog({ patient, isOpen, onClose }: { patient: Patient; isOpen: boolean; onClose: () => void }) {
  const { run } = useDemo();
  const [date, setDate] = useState("");
  useEffect(() => {
    if (isOpen) setDate(isoLocal().slice(0, 10));
  }, [isOpen]);
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Déclarer le décès"
      tone="danger"
      message="Cette action modifie le statut vital, annule les rendez-vous futurs et est tracée au journal. Elle nécessite une confirmation explicite."
      reasonLabel="Motif / circonstances (fictif)"
      typedConfirmation={patient.name}
      confirmLabel="Confirmer le décès"
      onConfirm={(reason) => run(declareDeath, { patientId: patient.id, date, reason, confirm: patient.name }).ok}
    >
      <TextField label="Date du décès" type="date" value={date} onChange={setDate} />
    </ConfirmDialog>
  );
}
