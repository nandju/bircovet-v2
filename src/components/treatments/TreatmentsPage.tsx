"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useNow } from "@/hooks/useNow";
import { PlusIcon } from "@/icons";
import { courseEnd } from "@/lib/treatments";
import { useState } from "react";
import TreatmentCard from "./TreatmentCard";
import TreatmentFormModal from "./TreatmentFormModal";
import TreatmentsSummary from "./TreatmentsSummary";

export default function TreatmentsPage() {
  const { db, can, today } = useDemo();
  const now = useNow();
  const create = useModal();
  const [tab, setTab] = useState("hospitalisation");
  const all = db.treatments ?? [];
  const isActive = (c: (typeof all)[number]) => c.status === "actif" && courseEnd(c) >= today;
  const list = all.filter((c) => (tab === "termines" ? !isActive(c) : isActive(c) && c.setting === tab));
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Suivi des traitements"
        subtitle="Prises faites en clinique par l'équipe, prises confirmées à domicile par les propriétaires, et évolution"
        actions={(can("hospitalisation", "update") || can("consultations", "create")) && <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>Nouveau traitement</Button>}
      />
      <TreatmentsSummary now={now} />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "hospitalisation", label: "En clinique", count: all.filter((c) => isActive(c) && c.setting === "hospitalisation").length },
          { key: "domicile", label: "À domicile", count: all.filter((c) => isActive(c) && c.setting === "domicile").length },
          { key: "termines", label: "Terminés / arrêtés", count: all.filter((c) => !isActive(c)).length },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {list.map((c) => <TreatmentCard key={c.id} c={c} now={now} />)}
      </div>
      {list.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucun traitement dans cette liste.</p>}
      <TreatmentFormModal isOpen={create.isOpen} onClose={create.closeModal} preset={tab === "domicile" ? { setting: "domicile" } : tab === "hospitalisation" ? { setting: "hospitalisation" } : undefined} />
    </div>
  );
}
