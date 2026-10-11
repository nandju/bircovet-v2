"use client";

import DemoNotice from "@/components/common/DemoNotice";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import { useDemo } from "@/context/DemoStoreContext";
import { patientName, productName } from "@/lib/calc";
import { normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import type { Prescription } from "@/lib/types";
import { useMemo, useState } from "react";
import { DeliveryModal } from "./PrescriptionModals";
import PrescriptionsTable from "./PrescriptionsTable";

export default function PrescriptionsPage() {
  const { db } = useDemo();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [deliver, setDeliver] = useState<Prescription | null>(null);
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.prescriptions.filter((p) => (!f.status || p.status === f.status) && (!t || normalize(`${p.code} ${patientName(db, p.patientId)} ${productName(db, p.productId)}`).includes(t)));
  }, [db, q, f]);
  const toDeliver = db.prescriptions.filter((p) => p.status === "validee" || p.status === "partiellement_delivree").length;
  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Prescriptions et délivrances" subtitle={`${toDeliver} prescription(s) à délivrer`} trail={[{ label: "Consultations", href: "/consultations" }]} />
      <DemoNotice>Règles simulées : une prescription ne diminue jamais le stock ; seule une délivrance ou administration confirmée crée un mouvement, une seule fois. Les lots périmés ou en quarantaine sont bloqués. Cliquez sur une ligne pour voir l&apos;historique des délivrances.</DemoNotice>
      <Panel>
        <FilterBar search={q} onSearch={setQ} searchPlaceholder="Ordonnance, patient, produit…" values={f} onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))} filters={[{ key: "status", label: "Tous les statuts", options: optionsOf("prescription") }]} />
        <PrescriptionsTable rows={rows} onDeliver={setDeliver} showPatient />
      </Panel>
      <DeliveryModal prescription={deliver} onClose={() => setDeliver(null)} />
    </div>
  );
}
