"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useState } from "react";
import FollowUpPlans from "./FollowUpPlans";
import FollowUpQueue, { useDueTouches } from "./FollowUpQueue";
import FollowUpTemplates from "./FollowUpTemplates";
import ProspectsBoard from "./ProspectsBoard";

type Tab = "relances" | "prospects" | "parcours" | "modeles";

/** Suivi client : relances automatiques J0 → J120 → tous les 4-6 mois, et entonnoir des prospects. */
export default function FollowUpPage() {
  const { db, today } = useDemo();
  const initial = (useQueryParam("onglet") as Tab | null) ?? "relances";
  const [tab, setTab] = useState<Tab>(initial);
  const due = useDueTouches(0).length;
  const prospectsDue = (db.prospects ?? []).filter((p) => ["nouveau", "contacte", "besoin_identifie", "proposition"].includes(p.stage) && p.nextActionDate && p.nextActionDate <= today).length;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Suivi client" subtitle="Relances après chaque visite, prospects et messages types" trail={[{ label: "Relation client", href: "/relation-client" }]} />
      <Tabs
        tabs={[
          { key: "relances", label: "Relances à faire", count: due },
          { key: "prospects", label: "Prospects", count: prospectsDue },
          { key: "parcours", label: "Parcours de suivi" },
          { key: "modeles", label: "Messages et cadence" },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />
      {tab === "relances" && <FollowUpQueue />}
      {tab === "prospects" && <ProspectsBoard />}
      {tab === "parcours" && <FollowUpPlans />}
      {tab === "modeles" && <FollowUpTemplates />}
    </div>
  );
}
