"use client";

import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { DownloadIcon } from "@/icons";
import { lotRef, productName, userName } from "@/lib/calc";
import { addDays, formatDateTime } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { exportCsv } from "@/utils/export";
import { useMemo, useState } from "react";
import MovementsTable from "./MovementsTable";

export default function MovementsPage() {
  const { db, today, establishment } = useDemo();
  const opts = useOptions();
  const [f, setF] = useState<Record<string, string>>({ period: "90", est: establishment?.id ?? "" });
  const rows = useMemo(() => {
    const from = f.period ? addDays(today, -Number(f.period)) : "";
    return db.movements.filter((m) => m.date.slice(0, 10) >= from && (!f.type || m.type === f.type) && (!f.product || m.productId === f.product) && (!f.est || m.establishmentId === f.est));
  }, [db, f, today]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Mouvements de stock"
        subtitle="Historique traçable : chaque mouvement est relié à son opération d'origine"
        trail={[{ label: "Stock", href: "/stock" }]}
        actions={
          <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => exportCsv("bircovet-mouvements-demo", ["Date", "Type", "Article", "Lot", "Quantité", "Origine", "Utilisateur"], rows.map((m) => [formatDateTime(m.date), labelOf("movement", m.type), productName(db, m.productId), lotRef(db, m.lotId), m.qty, m.note, userName(db, m.userId)]))}>
            Export CSV
          </Button>
        }
      />
      <Panel>
        <FilterBar
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "period", label: "Toute période", options: [{ value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }, { value: "365", label: "12 mois" }] },
            { key: "type", label: "Tous types", options: optionsOf("movement") },
            { key: "product", label: "Tous articles", options: opts.products },
            { key: "est", label: "Tous établissements", options: opts.establishments },
          ]}
        />
        <MovementsTable rows={rows} />
      </Panel>
    </div>
  );
}
