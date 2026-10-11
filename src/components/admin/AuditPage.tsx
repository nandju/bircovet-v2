"use client";

import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { DownloadIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { addDays, formatDateTime, normalize } from "@/lib/format";
import { exportCsv } from "@/utils/export";
import { useMemo, useState } from "react";

export default function AuditPage() {
  const { db, today } = useDemo();
  const opts = useOptions();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const modules = Array.from(new Set(db.audit.map((a) => a.module))).sort().map((m) => ({ value: m, label: m }));
  const rows = useMemo(() => {
    const t = normalize(q);
    const from = f.period ? addDays(today, -Number(f.period)) : "";
    return db.audit.filter((a) => a.date.slice(0, 10) >= from && (!f.user || a.userId === f.user) && (!f.module || a.module === f.module) && (!t || normalize(`${a.action} ${a.target} ${a.reason ?? ""} ${a.newValue ?? ""}`).includes(t)));
  }, [db, q, f, today]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Journal d'activité"
        subtitle="Alimenté par les actions importantes effectuées dans la démonstration"
        trail={[{ label: "Administration", href: "/administration/utilisateurs" }]}
        actions={<Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => exportCsv("bircovet-journal-demo", ["Date", "Utilisateur", "Module", "Action", "Élément", "Ancienne valeur", "Nouvelle valeur", "Motif", "Décision"], rows.map((a) => [formatDateTime(a.date), userName(db, a.userId), a.module, a.action, a.target, a.oldValue, a.newValue, a.reason, a.decision]))}>Export CSV</Button>}
      />
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Action, élément, motif…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "user", label: "Tous utilisateurs", options: db.users.map((u) => ({ value: u.id, label: u.name })) },
            { key: "module", label: "Tous modules", options: modules },
            { key: "period", label: "Toute période", options: [{ value: "1", label: "24 h" }, { value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }] },
          ]}
        />
        <DataTable
          rows={rows}
          rowKey={(a) => a.id}
          pageSize={15}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "d", header: "Date et heure", primary: true, sortValue: (a) => a.date, render: (a) => formatDateTime(a.date) },
            { key: "u", header: "Utilisateur", render: (a) => userName(db, a.userId) },
            { key: "m", header: "Module", render: (a) => a.module },
            { key: "a", header: "Action", render: (a) => <span className="font-medium">{a.action}</span> },
            { key: "t", header: "Élément", render: (a) => a.target },
            { key: "v", header: "Avant → après", hideOnMobile: true, render: (a) => (a.oldValue || a.newValue ? <span className="text-theme-xs">{a.oldValue ?? "—"} → {a.newValue ?? "—"}</span> : "—") },
            { key: "r", header: "Motif / décision", hideOnMobile: true, render: (a) => <span className="text-theme-xs">{[a.reason, a.decision].filter(Boolean).join(" · ") || "—"}</span> },
          ]}
          emptyTitle="Aucune entrée"
        />
      </Panel>
      {opts.users.length === 0 && null}
    </div>
  );
}
