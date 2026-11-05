"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable, { type Column } from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { clientName } from "@/lib/calc";
import { formatDate, normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createFarm, currentHeadcount, type FarmInput } from "@/lib/services/farmsService";
import { farmHerd, farmScale, HERD, mapsLink, SCALE_META, scaleLabel } from "@/lib/farmProfile";
import ScaleSettingsModal from "./ScaleSettingsModal";
import { cn } from "@/utils";
import type { Farm } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const EMPTY: FarmInput = { name: "", clientId: "", type: "avicole", location: "", region: "", gps: "", access: "", managerName: "", managerPhone: "", status: "actif", herd: [{ species: "Volaille", count: 0 }] };

export function FarmFormModal({ isOpen, onClose, initial, onSave }: { isOpen: boolean; onClose: () => void; initial?: FarmInput; onSave: (v: FarmInput) => boolean }) {
  const opts = useOptions();
  const [v, setV] = useState<FarmInput>(EMPTY);
  useEffect(() => {
    if (isOpen) setV(initial ?? EMPTY);
  }, [isOpen, initial]);
  const set = <K extends keyof FarmInput>(k: K, x: FarmInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const setHerd = (k: number, patch: Partial<NonNullable<FarmInput["herd"]>[number]>) => setV((s) => ({ ...s, herd: (s.herd ?? []).map((h, i) => (i === k ? { ...h, ...patch } : h)) }));
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={initial ? "Modifier l'exploitation" : "Nouvelle exploitation"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" disabled={!v.name.trim() || !v.clientId} onClick={() => onSave(v) && onClose()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Nom de l'exploitation" required value={v.name} onChange={(x) => set("name", x)} />
        <SelectField label="Client associé" required value={v.clientId} onChange={(x) => set("clientId", x)} options={opts.clients} />
        {initial && <SelectField label="Type d'élevage" value={v.type} onChange={(x) => set("type", x as FarmInput["type"])} options={optionsOf("farmType")} />}
        <SelectField label="Statut" value={v.status} onChange={(x) => set("status", x as FarmInput["status"])} options={optionsOf("farm")} />
        <TextField label="Localité" value={v.location} onChange={(x) => set("location", x)} />
        <TextField label="Région" value={v.region} onChange={(x) => set("region", x)} />
        <TextField label="Responsable sur site" value={v.managerName} onChange={(x) => set("managerName", x)} />
        <TextField label="Téléphone du responsable" value={v.managerPhone} onChange={(x) => set("managerPhone", x)} />
        <TextField label="Coordonnées GPS" value={v.gps} onChange={(x) => set("gps", x)} placeholder="5.4642, -4.0612" />
        <TextField label="Lien Google Maps" value={v.mapsUrl ?? ""} onChange={(x) => set("mapsUrl", x.trim() || undefined)} placeholder="https://maps.app.goo.gl/…" hint="Dans Google Maps : Partager → Copier le lien" className="sm:col-span-2" />
        <TextAreaField label="Informations d'accès" value={v.access} onChange={(x) => set("access", x)} rows={2} />
      </FormGrid>
      {!initial && (
        <fieldset className="mt-5 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Cheptel : espèces et effectifs</legend>
          <p className="mb-2 text-theme-xs text-gray-500">Une ligne par espèce ; un lot est créé pour chacune (vous pourrez en ajouter d&apos;autres ensuite).</p>
          <div className="space-y-2">
            {(v.herd ?? []).map((h, k) => (
              <div key={k} className="grid grid-cols-[1fr_6rem_1fr_auto] items-center gap-2">
                <select aria-label="Espèce" value={h.species} onChange={(e) => setHerd(k, { species: e.target.value })} className="h-10 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
                  {HERD.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input aria-label="Effectif" type="number" min={0} value={h.count || ""} onChange={(e) => setHerd(k, { count: Number(e.target.value) })} placeholder="Effectif" className="h-10 rounded-lg border border-gray-300 bg-transparent px-2 text-sm tabular-nums dark:border-gray-700 dark:text-white/90" />
                <input aria-label="Catégorie" value={h.category ?? ""} onChange={(e) => setHerd(k, { category: e.target.value })} placeholder="Ex. : pondeuses, chair, laitières…" className="h-10 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
                <Button size="xs" variant="ghost" onClick={() => set("herd", (v.herd ?? []).filter((_, i) => i !== k))} aria-label="Retirer">✕</Button>
              </div>
            ))}
          </div>
          <Button size="xs" variant="soft" className="mt-2" onClick={() => set("herd", [...(v.herd ?? []), { species: HERD.find((s) => !(v.herd ?? []).some((h) => h.species === s)) ?? "Volaille", count: 0 }])}>+ Ajouter une espèce</Button>
        </fieldset>
      )}
    </AppModal>
  );
}

export default function FarmsList() {
  const { db, run, today, user } = useDemo();
  const [scaleOpen, setScaleOpen] = useState(false);
  const router = useRouter();
  const create = useModal();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const regions = Array.from(new Set(db.farms.map((x) => x.region))).map((r) => ({ value: r, label: r }));
  const managers = Array.from(new Set(db.farms.map((x) => x.managerName))).map((r) => ({ value: r, label: r }));
  const scales = useMemo(() => new Map(db.farms.map((x) => [x.id, farmScale(db, x, today).scale])), [db, today]);
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.farms.filter((x) => (!f.scale || scales.get(x.id) === f.scale) && (!f.species || farmHerd(x).some((h) => h.species === f.species)) && (!f.type || x.type === f.type) && (!f.status || x.status === f.status) && (!f.region || x.region === f.region) && (!f.manager || x.managerName === f.manager) && (!t || normalize(`${x.name} ${x.code} ${x.location} ${clientName(db, x.clientId)}`).includes(t)));
  }, [db, q, f, scales]);

  const columns: Column<Farm>[] = [
    { key: "n", header: "Exploitation", primary: true, sortValue: (x) => x.name, render: (x) => <span className="flex flex-col"><span className="font-medium text-gray-800 dark:text-white/90">{x.name}</span><span className="text-theme-xs text-gray-500">{x.code}</span></span> },
    { key: "t", header: "Cheptel", render: (x) => <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-theme-xs">{farmHerd(x).map((h) => <span key={h.species} className="inline-flex items-center gap-1"><SpeciesIcon species={h.species} />{h.count.toLocaleString("fr-FR")}</span>)}{!farmHerd(x).length && "—"}</span> },
    { key: "k", header: "Catégorie", sortValue: (x) => ["petit", "moyen", "gros"].indexOf(scales.get(x.id) ?? "petit"), render: (x) => <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", SCALE_META[scales.get(x.id) ?? "petit"].chip)}>{scaleLabel(db, scales.get(x.id) ?? "petit")}{x.scaleOverride ? " ✎" : ""}</span> },
    { key: "map", header: "", render: (x) => { const u = mapsLink(x); return u ? <a href={u} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-theme-xs font-medium text-tertiary-600 hover:underline">Maps ↗</a> : null; } },
    { key: "c", header: "Client", render: (x) => clientName(db, x.clientId) },
    { key: "l", header: "Localisation", sortValue: (x) => x.location, render: (x) => `${x.location} (${x.region})` },
    { key: "m", header: "Responsable", render: (x) => x.managerName, hideOnMobile: true },
    { key: "e", header: "Effectif actuel", align: "end", sortValue: (x) => x.lots.reduce((s, l) => s + currentHeadcount(x, l.id), 0), render: (x) => x.lots.reduce((s, l) => s + currentHeadcount(x, l.id), 0).toLocaleString("fr-FR") },
    { key: "v", header: "Dernière visite", render: (x) => formatDate([...x.visits].sort((a, b) => b.date.localeCompare(a.date))[0]?.date), hideOnMobile: true },
    { key: "s", header: "Statut", render: (x) => <StatusBadge kind="farm" value={x.status} /> },
  ];

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Exploitations et élevages"
        actions={
          <>
          {user?.roleId === "dg" && <Button size="sm" variant="outline" onClick={() => setScaleOpen(true)}>Catégories d&apos;éleveurs</Button>}
          <Can module="exploitations" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
              Nouvelle exploitation
            </Button>
          </Can>
          </>
        }
      />
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Nom, localité, client…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "species", label: "Toutes les espèces", options: HERD.map((s) => ({ value: s, label: s })) },
            { key: "scale", label: "Toutes les catégories", options: (["petit", "moyen", "gros"] as const).map((s) => ({ value: s, label: scaleLabel(db, s) })) },
            { key: "region", label: "Toutes les régions", options: regions },
            { key: "manager", label: "Tous les responsables", options: managers },
            { key: "status", label: "Tous les statuts", options: optionsOf("farm") },
          ]}
        />
        <DataTable rows={rows} columns={columns} rowKey={(x) => x.id} onRowClick={(x) => router.push(`/exploitations/${x.id}`)} emptyTitle="Aucune exploitation" />
      </Panel>
      <ScaleSettingsModal isOpen={scaleOpen} onClose={() => setScaleOpen(false)} />
      <FarmFormModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        onSave={(v) => {
          const r = run(createFarm, v);
          if (r.ok && r.data) router.push(`/exploitations/${r.data}`);
          return r.ok;
        }}
      />
    </div>
  );
}
