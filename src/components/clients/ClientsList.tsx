"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable, { type Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { DownloadIcon, MergeIcon, PlusIcon } from "@/icons";
import { clientOutstanding } from "@/lib/calc";
import { formatDate, formatXOF, normalize } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { duplicateGroups } from "@/lib/services/clientsService";
import type { Client } from "@/lib/types";
import { exportCsv } from "@/utils/export";
import { ACTIVITY_META, activitiesOf, type Activity } from "@/lib/clientActivity";
import { cn } from "@/utils";
import ClientDirectory from "./ClientDirectory";
import { useMemo, useState } from "react";

export default function ClientsList({ activity }: { activity?: "compagnie" | "rente" } = {}) {
  const { db, today } = useDemo();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>(activity ? { activity } : {});
  const [mode, setMode] = useState<"liste" | "annuaire">("liste");
  const [print, setPrint] = useState(false);

  const nextTouch = (clientId: string) => {
    let best: { label: string; due: string; late: boolean } | undefined;
    for (const pl of db.followUps ?? []) {
      if (pl.clientId !== clientId || pl.status !== "actif") continue;
      for (const t of pl.touches) if (t.status === "a_faire" && (!best || t.dueDate < best.due)) best = { label: t.label, due: t.dueDate, late: t.dueDate < today };
    }
    return best;
  };
  const dupIds = useMemo(() => new Set(duplicateGroups(db).flat().map((c) => c.id)), [db]);
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.clients.filter(
      (c) =>
        (!f.type || c.type === f.type) &&
        (!f.status || c.status === f.status) &&
        (!f.segment || c.segment === f.segment) &&
        !c.isWalkIn &&
        (!f.activity || (f.activity === "mixte" ? activitiesOf(db, c).filter((a) => a !== "pharmacie").length > 1 : activitiesOf(db, c).includes(f.activity as Activity))) &&
        (!t || normalize(`${c.name} ${c.code} ${c.phone} ${c.email} ${c.city}`).includes(t)),
    );
  }, [db, q, f]);

  const columns: Column<Client>[] = [
    {
      key: "name",
      header: "Client",
      primary: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <span className="flex flex-col">
          <span className="font-medium text-gray-800 dark:text-white/90">
            {c.name}
            {dupIds.has(c.id) && <span className="ms-2 rounded-full bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">Doublon potentiel</span>}
            {c.incomplete && <span className="ms-2 rounded-full bg-warning-50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">Fiche à compléter</span>}
          </span>
          <span className="text-theme-xs text-gray-500">{c.code}</span>
        </span>
      ),
    },
    {
      key: "activity",
      header: "Activités",
      render: (c) => (
        <span className="flex flex-wrap gap-1">
          {activitiesOf(db, c).map((a) => (
            <span key={a} className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", ACTIVITY_META[a].cls)}>{ACTIVITY_META[a].short}</span>
          ))}
        </span>
      ),
    },
    ...(activity ? [] : [{ key: "type", header: "Type", sortValue: (c: Client) => c.type, render: (c: Client) => <StatusBadge kind="clientType" value={c.type} />, hideOnMobile: true }]),
    { key: "phone", header: "Téléphone", render: (c) => <span className="whitespace-nowrap">{c.phoneCode} {c.phone}</span> },
    { key: "city", header: "Ville", sortValue: (c) => c.city, render: (c) => c.city, hideOnMobile: true },
    { key: "patients", header: "Patients", align: "center", sortValue: (c) => db.patients.filter((p) => p.ownerId === c.id).length, render: (c) => db.patients.filter((p) => p.ownerId === c.id).length },
    { key: "segment", header: "Segment", render: (c) => <StatusBadge kind="segment" value={c.segment} />, hideOnMobile: true },
    {
      key: "balance",
      header: "Impayés",
      align: "end",
      sortValue: (c) => clientOutstanding(db, c.id),
      render: (c) => {
        const v = clientOutstanding(db, c.id);
        return <span className={v > 0 ? "font-medium text-error-600 dark:text-error-400" : "text-gray-400"}>{v > 0 ? formatXOF(v) : "—"}</span>;
      },
    },
    {
      key: "follow",
      header: "Prochain suivi",
      sortValue: (c) => nextTouch(c.id)?.due ?? "9999",
      render: (c) => {
        const n = nextTouch(c.id);
        return n ? <span className={cn("text-theme-xs", n.late ? "font-medium text-error-600" : "text-gray-600 dark:text-gray-400")}>{n.label} · {formatDate(n.due)}{n.late ? " · en retard" : ""}</span> : <span className="text-theme-xs text-gray-400">—</span>;
      },
    },
    { key: "status", header: "Statut", render: (c) => <StatusBadge kind="client" value={c.status} /> },
  ];

  const doExport = () =>
    exportCsv(
      "cliva-clients-demo",
      ["Code", "Nom", "Type", "Téléphone", "E-mail", "Ville", "Segment", "Statut", "Créé le", "Impayés (XOF)"],
      rows.map((c) => [c.code, c.name, labelOf("clientType", c.type), `${c.phoneCode} ${c.phone}`, c.email, c.city, labelOf("segment", c.segment), labelOf("client", c.status), formatDate(c.createdAt), clientOutstanding(db, c.id)]),
    );

  return (
    <div>
      <PageBreadcrumb
        pageTitle={activity === "compagnie" ? "Clients — animaux de compagnie" : activity === "rente" ? "Clients — éleveurs (animaux de rente)" : "Tous les clients"}
        subtitle={activity ? `${rows.length} client(s) · ${rows.filter((c) => nextTouch(c.id)?.late).length} relance(s) en retard · le suivi de chaque client est dans sa fiche` : `${db.clients.filter((c) => !c.isWalkIn).length} clients au total · ${db.clients.filter((c) => c.status === "actif" && !c.isWalkIn).length} actifs · ${dupIds.size} fiche(s) en doublon potentiel`}
        actions={
          <>
            <div role="tablist" aria-label="Affichage" className="flex rounded-full border border-gray-200/70 bg-white p-1 shadow-cliva dark:border-gray-800 dark:bg-gray-900">
              {(["liste", "annuaire"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition", mode === k ? "bg-linear-to-br from-brand-500 to-brand-600 text-white" : "text-gray-600 dark:text-gray-300")}>{k === "liste" ? "Liste" : "Annuaire complet"}</button>
              ))}
            </div>
            {mode === "annuaire" && <Button variant="outline" size="sm" onClick={() => setPrint(true)}>Imprimer l&apos;annuaire</Button>}
            <Button variant="outline" size="sm" startIcon={<DownloadIcon />} onClick={doExport}>
              Export CSV
            </Button>
            <Can module="clients" action="update">
              <Link href="/clients/fusion" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-gray-700 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/3 [&>svg]:size-4">
                <MergeIcon /> Doublons et fusion
              </Link>
            </Can>
            <Can module="clients" action="create">
              <Button size="sm" startIcon={<PlusIcon />} onClick={() => router.push("/clients/nouveau")}>
                Nouveau client
              </Button>
            </Can>
          </>
        }
      />
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Nom, code, téléphone, e-mail…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "activity", label: "Toutes les activités", options: [{ value: "compagnie", label: "Animaux de compagnie" }, { value: "rente", label: "Animaux de rente" }, { value: "pharmacie", label: "Achats au comptoir" }, { value: "mixte", label: "Compagnie + rente" }] },
            { key: "type", label: "Tous les types", options: optionsOf("clientType") },
            { key: "status", label: "Tous les statuts", options: optionsOf("client") },
            { key: "segment", label: "Tous les segments", options: optionsOf("segment") },
          ]}
        />
        {mode === "liste" ? (
          <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={(c) => router.push(`/clients/${c.id}`)} initialSort={{ key: "name", dir: "asc" }} emptyTitle="Aucun client trouvé" />
        ) : (
          <ClientDirectory rows={[...rows].sort((a, b) => a.name.localeCompare(b.name))} print={print} onClosePrint={() => setPrint(false)} />
        )}
      </Panel>
    </div>
  );
}
