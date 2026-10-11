"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import LinkedDocuments from "@/components/documents/LinkedDocuments";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { Link } from "@/i18n/navigation";
import { MapPinIcon, PencilIcon, PlusIcon } from "@/icons";
import { clientName, userName } from "@/lib/calc";
import { formatDate, isoDay } from "@/lib/format";
import { addAnimalMovement, addBuilding, addFarmLot, addFarmVisit, addHeadcount, currentHeadcount, updateFarm } from "@/lib/services/farmsService";
import type { AnimalMovement } from "@/lib/types";
import { useState } from "react";
import { FarmFormModal } from "./FarmsList";

type ModalKind = null | "edit" | "building" | "lot" | "headcount" | "movement" | "visit";

export default function FarmDetail({ id }: { id: string }) {
  const { db, run } = useDemo();
  const opts = useOptions();
  const [tab, setTab] = useState("general");
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const f = db.farms.find((x) => x.id === id);
  if (!f) return <p className="text-sm text-gray-500">Exploitation introuvable.</p>;
  const missions = db.missions.filter((m) => m.farmIds.includes(f.id));
  const open = (k: ModalKind, init: Record<string, string | number> = {}) => {
    setForm({ date: isoDay(), ...init });
    setModal(k);
  };
  const close = () => setModal(null);
  const s = (k: string) => String(form[k] ?? "");
  const n = (k: string) => Number(form[k] ?? NaN);
  const set = (k: string) => (v: string | number) => setForm((x) => ({ ...x, [k]: v }));
  const lotName = (lotId: string) => f.lots.find((l) => l.id === lotId)?.name ?? "—";

  const save = () => {
    let ok = false;
    if (modal === "building") ok = run(addBuilding, { farmId: f.id, b: { name: s("name"), kind: s("kind") || "Bâtiment d'élevage", capacity: n("capacity") || 0 } }).ok;
    if (modal === "lot") ok = run(addFarmLot, { farmId: f.id, lot: { name: s("name"), species: s("species"), buildingId: s("buildingId") || undefined, startDate: s("date") }, initialCount: n("count") || 0 }).ok;
    if (modal === "headcount") ok = run(addHeadcount, { farmId: f.id, lotId: s("lotId"), date: s("date"), count: n("count") }).ok;
    if (modal === "movement") ok = run(addAnimalMovement, { farmId: f.id, mv: { lotId: s("lotId"), date: s("date"), type: (s("type") || "entree") as AnimalMovement["type"], count: n("count"), note: s("note") } }).ok;
    if (modal === "visit") ok = run(addFarmVisit, { farmId: f.id, visit: { date: s("date"), vetId: s("vetId"), purpose: s("purpose"), report: s("report") } }).ok;
    if (ok) close();
  };
  const lotOptions = f.lots.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={f.name}
        subtitle={`${f.code} · ${f.location} (${f.region})`}
        trail={[{ label: "Exploitations", href: "/exploitations" }]}
        actions={
          <Can module="exploitations" action="update">
            <Button size="sm" variant="outline" startIcon={<PencilIcon />} onClick={() => setModal("edit")}>
              Modifier
            </Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => open("visit")}>
              Visite
            </Button>
          </Can>
        }
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "Vue générale" },
          { key: "buildings", label: "Bâtiments", count: f.buildings.length },
          { key: "lots", label: "Lots / troupeaux", count: f.lots.length },
          { key: "headcounts", label: "Effectifs datés", count: f.headcounts.length },
          { key: "movements", label: "Mouvements", count: f.movements.length },
          { key: "visits", label: "Visites et interventions", count: f.visits.length + missions.length },
          { key: "docs", label: "Rapports et documents" },
        ]}
      />

      {tab === "general" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <ComponentCard title="Informations">
            <InfoGrid
              items={[
                { label: "Client", value: <Link href={`/clients/${f.clientId}`} className="text-brand-600 hover:underline">{clientName(db, f.clientId)}</Link> },
                { label: "Type d'élevage", value: <StatusBadge kind="farmType" value={f.type} /> },
                { label: "Statut", value: <StatusBadge kind="farm" value={f.status} /> },
                { label: "Créée le", value: formatDate(f.createdAt) },
                { label: "Effectif total actuel", value: f.lots.reduce((s2, l) => s2 + currentHeadcount(f, l.id), 0).toLocaleString("fr-FR") },
                { label: "Bâtiments", value: f.buildings.length },
              ]}
            />
          </ComponentCard>
          <ComponentCard title="Contacts, localisation et accès">
            <InfoGrid
              items={[
                { label: "Responsable", value: `${f.managerName} — ${f.managerPhone}` },
                { label: "Contacts", value: f.contacts.map((c) => `${c.name} (${c.relation}) ${c.phone}`).join(" ; ") },
                { label: "Localisation", value: <span className="inline-flex items-center gap-1"><MapPinIcon className="size-4 text-tertiary-500" />{f.location}, {f.region}</span> },
                { label: "GPS (fictif)", value: f.gps },
                { label: "Accès", value: f.access, wide: true },
              ]}
            />
          </ComponentCard>
        </div>
      )}

      {tab === "buildings" && (
        <ComponentCard title="Bâtiments" actions={<Can module="exploitations" action="update"><Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("building")}>Ajouter</Button></Can>}>
          <DataTable rows={f.buildings} rowKey={(b) => b.id} columns={[{ key: "n", header: "Nom", primary: true, render: (b) => b.name }, { key: "k", header: "Type", render: (b) => b.kind }, { key: "c", header: "Capacité", align: "end", render: (b) => b.capacity.toLocaleString("fr-FR") }, { key: "l", header: "Lots", render: (b) => f.lots.filter((l) => l.buildingId === b.id).map((l) => l.name).join(", ") || "—" }]} emptyTitle="Aucun bâtiment" />
        </ComponentCard>
      )}

      {tab === "lots" && (
        <ComponentCard title="Lots et troupeaux" actions={<Can module="exploitations" action="update"><Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("lot")}>Ajouter un lot</Button></Can>}>
          <DataTable rows={f.lots} rowKey={(l) => l.id} columns={[{ key: "n", header: "Lot", primary: true, render: (l) => l.name }, { key: "s", header: "Espèce", render: (l) => l.species }, { key: "b", header: "Bâtiment", render: (l) => f.buildings.find((b) => b.id === l.buildingId)?.name ?? "—" }, { key: "d", header: "Mise en place", render: (l) => formatDate(l.startDate) }, { key: "e", header: "Effectif actuel", align: "end", render: (l) => currentHeadcount(f, l.id).toLocaleString("fr-FR") }]} emptyTitle="Aucun lot" />
        </ComponentCard>
      )}

      {tab === "headcounts" && (
        <ComponentCard title="Effectifs datés" actions={<Can module="exploitations" action="update"><Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("headcount", { lotId: f.lots[0]?.id ?? "" })} disabled={!f.lots.length}>Saisir un effectif</Button></Can>}>
          <DataTable rows={[...f.headcounts].sort((a, b) => b.date.localeCompare(a.date))} rowKey={(h) => h.id} columns={[{ key: "d", header: "Date", primary: true, render: (h) => formatDate(h.date) }, { key: "l", header: "Lot", render: (h) => lotName(h.lotId) }, { key: "c", header: "Effectif", align: "end", render: (h) => h.count.toLocaleString("fr-FR") }, { key: "s", header: "Source", render: (h) => h.source }, { key: "a", header: "Auteur", render: (h) => userName(db, h.authorId) }]} emptyTitle="Aucun effectif" />
        </ComponentCard>
      )}

      {tab === "movements" && (
        <ComponentCard title="Mouvements des animaux" actions={<Can module="exploitations" action="update"><Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("movement", { lotId: f.lots[0]?.id ?? "", type: "entree" })} disabled={!f.lots.length}>Enregistrer</Button></Can>}>
          <DataTable rows={[...f.movements].sort((a, b) => b.date.localeCompare(a.date))} rowKey={(m) => m.id} columns={[{ key: "d", header: "Date", primary: true, render: (m) => formatDate(m.date) }, { key: "l", header: "Lot", render: (m) => lotName(m.lotId) }, { key: "t", header: "Type", render: (m) => m.type }, { key: "c", header: "Nombre", align: "end", render: (m) => m.count.toLocaleString("fr-FR") }, { key: "n", header: "Note", render: (m) => m.note }]} emptyTitle="Aucun mouvement" />
        </ComponentCard>
      )}

      {tab === "visits" && (
        <div className="space-y-4">
          <ComponentCard title="Historique des visites">
            <DataTable rows={[...f.visits].sort((a, b) => b.date.localeCompare(a.date))} rowKey={(v) => v.id} columns={[{ key: "d", header: "Date", primary: true, render: (v) => formatDate(v.date) }, { key: "p", header: "Objet", render: (v) => v.purpose }, { key: "v", header: "Vétérinaire", render: (v) => userName(db, v.vetId) }, { key: "r", header: "Rapport", render: (v) => <span className="line-clamp-2">{v.report}</span> }]} emptyTitle="Aucune visite" />
          </ComponentCard>
          <ComponentCard title="Missions terrain associées">
            <DataTable rows={missions} rowKey={(m) => m.id} columns={[{ key: "c", header: "Mission", primary: true, render: (m) => <Link href={`/missions/${m.id}`} className="font-medium text-brand-600 hover:underline">{m.code}</Link> }, { key: "o", header: "Objectif", render: (m) => m.objective }, { key: "d", header: "Date", render: (m) => formatDate(m.date) }, { key: "s", header: "Statut", render: (m) => <StatusBadge kind="mission" value={m.status} /> }]} emptyTitle="Aucune mission" />
          </ComponentCard>
        </div>
      )}

      {tab === "docs" && (
        <ComponentCard title="Rapports et interventions">
          <LinkedDocuments refs={[{ kind: "exploitation", id: f.id }, ...missions.map((m) => ({ kind: "mission" as const, id: m.id }))]} addTo={{ kind: "exploitation", id: f.id }} />
        </ComponentCard>
      )}

      <FarmFormModal isOpen={modal === "edit"} onClose={close} initial={f} onSave={(v) => run(updateFarm, { id: f.id, patch: v }).ok} />
      <AppModal
        isOpen={!!modal && modal !== "edit"}
        onClose={close}
        title={{ building: "Nouveau bâtiment", lot: "Nouveau lot / troupeau", headcount: "Effectif daté", movement: "Mouvement d'animaux", visit: "Nouvelle visite", edit: "" }[modal ?? "edit"]}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={close}>
              Annuler
            </Button>
            <Button size="sm" onClick={save}>
              Enregistrer
            </Button>
          </>
        }
      >
        <FormGrid>
          {modal === "building" && (
            <>
              <TextField label="Nom" required value={s("name")} onChange={set("name")} />
              <TextField label="Type" value={s("kind")} onChange={set("kind")} />
              <NumberField label="Capacité" value={n("capacity")} onChange={set("capacity")} min={0} />
            </>
          )}
          {modal === "lot" && (
            <>
              <TextField label="Nom du lot" required value={s("name")} onChange={set("name")} />
              <TextField label="Espèce" value={s("species")} onChange={set("species")} />
              <SelectField label="Bâtiment" value={s("buildingId")} onChange={set("buildingId")} options={f.buildings.map((b) => ({ value: b.id, label: b.name }))} allowEmpty placeholder="Aucun" />
              <TextField label="Date de mise en place" type="date" value={s("date")} onChange={set("date")} />
              <NumberField label="Effectif initial" value={n("count")} onChange={set("count")} min={0} />
            </>
          )}
          {(modal === "headcount" || modal === "movement") && (
            <>
              <SelectField label="Lot" required value={s("lotId")} onChange={set("lotId")} options={lotOptions} />
              <TextField label="Date" type="date" value={s("date")} onChange={set("date")} />
              {modal === "movement" && <SelectField label="Type" value={s("type")} onChange={set("type")} options={[{ value: "entree", label: "Entrée" }, { value: "sortie", label: "Sortie" }, { value: "mortalite", label: "Mortalité" }, { value: "vente", label: "Vente" }, { value: "transfert", label: "Transfert" }]} />}
              <NumberField label={modal === "movement" ? "Nombre d'animaux" : "Effectif compté"} required value={n("count")} onChange={set("count")} min={0} />
              {modal === "movement" && <TextField label="Note" value={s("note")} onChange={set("note")} />}
            </>
          )}
          {modal === "visit" && (
            <>
              <TextField label="Date" type="date" value={s("date")} onChange={set("date")} />
              <SelectField label="Vétérinaire" required value={s("vetId")} onChange={set("vetId")} options={opts.vets} />
              <TextField label="Objet" required value={s("purpose")} onChange={set("purpose")} className="sm:col-span-2" />
              <TextAreaField label="Rapport (fictif)" value={s("report")} onChange={set("report")} rows={4} className="sm:col-span-2" />
            </>
          )}
        </FormGrid>
      </AppModal>
    </div>
  );
}
