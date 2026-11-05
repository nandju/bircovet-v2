"use client";

import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import type { Farm } from "@/lib/types";
import { useState } from "react";
import AssignModal, { type AssignPrefill } from "./AssignModal";
import PlanDetail from "./PlanDetail";
import PlanList from "./PlanList";

/** Onglet « Prophylaxie » d'une exploitation : programmes appliqués à ses bandes, son cheptel, ses animaux. */
export default function FarmProphylaxisTab({ farm: f }: { farm: Farm }) {
  const { db, can } = useDemo();
  const [assign, setAssign] = useState<AssignPrefill | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const plans = (db.prophylaxisPlans ?? []).filter((p) => p.farmId === f.id);
  const live = plans.filter((p) => p.status === "en_cours");
  const past = plans.filter((p) => p.status !== "en_cours");
  return (
    <div className="space-y-4">
      <ComponentCard
        title={`Programmes en cours (${live.length})`}
        desc="Vaccins, déparasitages et soins préventifs prévus pour cet élevage, avec leurs dates."
        actions={can("exploitations", "update") && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setAssign({ farmId: f.id })}>Appliquer un programme</Button>}
      >
        <PlanList plans={live} onOpen={setOpen} empty="Aucun programme en cours. Appliquez un modèle (poulets de chair, bovins…) à une bande ou à tout le cheptel." />
      </ComponentCard>
      {past.length > 0 && (
        <ComponentCard title={`Programmes terminés ou arrêtés (${past.length})`}>
          <PlanList plans={past} onOpen={setOpen} />
        </ComponentCard>
      )}
      <AssignModal prefill={assign} onClose={() => setAssign(null)} onSaved={setOpen} />
      <PlanDetail id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
