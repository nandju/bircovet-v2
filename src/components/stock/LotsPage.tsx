"use client";

import DemoNotice from "@/components/common/DemoNotice";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { lotRef, productName } from "@/lib/calc";
import { normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { useMemo, useState } from "react";
import LotsTable from "./LotsTable";

export default function LotsPage() {
  const { db, establishment, today } = useDemo();
  const opts = useOptions();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({ est: establishment?.id ?? "" });
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.lots.filter((l) => {
      const status = l.expiryDate < today ? "perime" : l.status;
      return (!f.est || l.establishmentId === f.est) && (!f.status || status === f.status) && (!f.supplier || l.supplierId === f.supplier) && (!t || normalize(`${productName(db, l.productId)} ${lotRef(db, l.id)}`).includes(t));
    });
  }, [db, q, f, today]);
  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Gestion des lots" trail={[{ label: "Stock", href: "/stock" }]} />
      <DemoNotice>Statuts : disponible, réservé, en quarantaine, périmé. Les délivrances sont bloquées sur les lots périmés ou en quarantaine ; la sélection automatique privilégie le lot utilisable à la péremption la plus proche (FEFO).</DemoNotice>
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Article, référence de lot…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "est", label: "Tous établissements", options: opts.establishments },
            { key: "status", label: "Tous statuts", options: optionsOf("lot") },
            { key: "supplier", label: "Tous fournisseurs", options: opts.suppliers },
          ]}
        />
        <LotsTable rows={rows} />
      </Panel>
    </div>
  );
}
