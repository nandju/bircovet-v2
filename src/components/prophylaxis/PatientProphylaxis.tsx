"use client";

import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { useState } from "react";
import AssignModal, { type AssignPrefill } from "./AssignModal";
import PlanDetail from "./PlanDetail";
import PlanList from "./PlanList";

/** Programmes de prophylaxie d'un animal de compagnie (dans l'onglet vaccins du patient). */
export default function PatientProphylaxis({ patientId, species }: { patientId: string; species: string }) {
  const { db, can } = useDemo();
  const [assign, setAssign] = useState<AssignPrefill | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const plans = (db.prophylaxisPlans ?? []).filter((p) => p.patientId === patientId);
  const model = (db.prophylaxisPrograms ?? []).find((p) => p.active && p.species === species);
  return (
    <div className="mb-4">
      <ComponentCard
        title="Programme de prophylaxie"
        desc="Le calendrier des vaccins et déparasitages prévus. Une vaccination notée « faite » s'ajoute au carnet ci-dessous."
        actions={can("patients", "update") && <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => setAssign({ patientId, programId: model?.id })}>Appliquer un programme</Button>}
      >
        <PlanList plans={plans} onOpen={setOpen} empty="Aucun programme. Appliquez par exemple le modèle chiot ou chaton : les dates des vaccins et déparasitages se calculent seules." />
      </ComponentCard>
      <AssignModal prefill={assign} onClose={() => setAssign(null)} onSaved={setOpen} />
      <PlanDetail id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
