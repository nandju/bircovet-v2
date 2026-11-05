"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
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
import { formatDate, formatXOF, isoDay } from "@/lib/format";
import { addFarmIntervention, addFarmLot, addFarmVisit, currentHeadcount, setFarmScale, setLotCount, updateFarm } from "@/lib/services/farmsService";
import type { FarmIntervention } from "@/lib/types";
import { farmScale, HERD, INTERVENTION_KINDS, mapsLink, SCALE_META, scaleLabel, speciesOf } from "@/lib/farmProfile";
import { cn } from "@/utils";
import FarmTimeline from "./FarmTimeline";
import FarmCareTab from "@/components/care/FarmCareTab";
import CareCaseModal, { type CarePrefill } from "@/components/care/CareCaseModal";
import CareCaseDetail from "@/components/care/CareCaseDetail";
import { useState } from "react";
import FarmProphylaxisTab from "@/components/prophylaxis/FarmProphylaxisTab";
import { FarmFormModal } from "./FarmsList";

type ModalKind = null | "edit" | "intervention" | "lot" | "count" | "scale" | "visit";

export default function FarmDetail({ id }: { id: string }) {
  const { db, run, today, can } = useDemo();
  const opts = useOptions();
  const [tab, setTab] = useState("general");
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [care, setCare] = useState<CarePrefill | null>(null);
  const [careOpen, setCareOpen] = useState<string | null>(null);
  const f = db.farms.find((x) => x.id === id);
  if (!f) return <p className="text-sm text-gray-500">Exploitation introuvable.</p>;
  const missions = db.missions.filter((m) => m.farmIds.includes(f.id));
  const prof = farmScale(db, f, today);
  const maps = mapsLink(f);
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
    if (modal === "lot") ok = run(addFarmLot, { farmId: f.id, lot: { name: s("name") || s("species"), species: s("species"), category: s("category") || undefined, ageRange: s("ageRange") || undefined, startDate: s("date") }, initialCount: n("count") || 0 }).ok;
    if (modal === "intervention") ok = run(addFarmIntervention, { farmId: f.id, it: { date: s("date"), kind: (s("kind") || "vaccination") as FarmIntervention["kind"], species: s("species"), lotId: s("lotId") || undefined, count: n("count") || 0, product: s("product") || undefined, problem: s("problem") || undefined, note: s("note"), lab: ["analyse", "autopsie", "prelevement"].includes(s("kind")) ? { name: s("labName") || undefined, test: s("labTest") || undefined, result: s("labResult") || undefined, status: (s("labStatus") || (s("labResult") ? "resultat" : "envoye")) as "envoye" | "resultat", reportUrl: s("labUrl") || undefined } : undefined } }).ok;
    if (modal === "count") ok = run(setLotCount, { farmId: f.id, lotId: s("lotId"), count: n("count"), status: (s("status") || "actif") as "actif" | "cloture" }).ok;
    if (modal === "scale") ok = run(setFarmScale, { farmId: f.id, scale: s("scale") ? (s("scale") as "petit" | "moyen" | "gros") : null, reason: s("reason") }).ok;
    if (modal === "visit") ok = run(addFarmVisit, { farmId: f.id, visit: { date: s("date"), vetId: s("vetId"), purpose: s("purpose"), report: s("report") } }).ok;
    if (ok) close();
  };
  const lotOptions = f.lots.map((l) => ({ value: l.id, label: `${l.name} (${speciesOf(l.species)})` }));

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={f.name}
        subtitle={`${f.code} · ${f.location} (${f.region})`}
        trail={[{ label: "Exploitations", href: "/exploitations" }]}
        actions={
          <Can module="exploitations" action="update">
            {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="cliva-press inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"><MapPinIcon className="size-4 text-tertiary-500" />Itinéraire</a>}
            <Button size="sm" variant="outline" startIcon={<PencilIcon />} onClick={() => setModal("edit")}>
              Modifier
            </Button>
            <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("visit")}>
              Visite
            </Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => setCare({ farmId: f.id })}>
              Consultation / prise en charge
            </Button>
          </Can>
        }
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: "Vue générale" },
          { key: "care", label: "Prises en charge", count: (db.careCases ?? []).filter((c) => c.farmId === f.id && c.status === "en_cours").length },
          { key: "prophylaxis", label: "Prophylaxie", count: (db.prophylaxisPlans ?? []).filter((p) => p.farmId === f.id && p.status === "en_cours").length },
          { key: "lots", label: "Lots par espèce", count: f.lots.length },
          { key: "interventions", label: "Interventions du cabinet", count: (f.interventions ?? []).length },
          { key: "history", label: "Historique" },
          { key: "visits", label: "Visites et interventions", count: f.visits.length + missions.length },
          { key: "docs", label: "Documents et liens" },
        ]}
      />

      {tab === "prophylaxis" && <FarmProphylaxisTab farm={f} />}
      {tab === "care" && <FarmCareTab farm={f} onNew={(p) => setCare(p)} onOpen={setCareOpen} />}
      <CareCaseModal prefill={care} onClose={() => setCare(null)} onSaved={(id) => { setTab("care"); setCareOpen(id); }} />
      <CareCaseDetail id={careOpen} onClose={() => setCareOpen(null)} onExtend={(p) => { setCareOpen(null); setCare(p); }} />

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
                { label: "Catégorie d'éleveur", value: <span className="inline-flex flex-wrap items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-theme-xs font-medium", SCALE_META[prof.scale].chip)}>{scaleLabel(db, prof.scale)}</span>{prof.manual && <span className="text-[11px] text-gray-500" title={f.scaleOverride?.reason}>fixée à la main</span>}<Can module="exploitations" action="update"><button type="button" onClick={() => open("scale", { scale: f.scaleOverride?.scale ?? "", reason: f.scaleOverride?.reason ?? "" })} className="text-[11px] font-medium text-brand-600 hover:underline">Modifier</button></Can></span> },
                { label: "Chiffre d'affaires client · 12 mois", value: formatXOF(prof.revenue) },
                { label: "Base du classement", value: `${prof.manual ? `fixée : ${f.scaleOverride?.reason} · ` : ""}calcul — effectif : ${scaleLabel(db, prof.herdTier).toLowerCase()} · achats : ${scaleLabel(db, prof.revenueTier).toLowerCase()}`, wide: true },
              ]}
            />
          </ComponentCard>
          <ComponentCard title="Cheptel par espèce" className="lg:col-span-2">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {prof.herd.map((h) => (
                <li key={h.species} className="rounded-xl border border-orange-200 bg-orange-25 p-3 dark:border-orange-500/20 dark:bg-orange-500/5">
                  <p className="flex items-center gap-1.5 text-theme-xs font-medium text-orange-700 dark:text-orange-300"><SpeciesIcon species={h.species} className="text-lg" />{h.species}</p>
                  <p className="text-xl font-semibold text-gray-900 tabular-nums dark:text-white">{h.count.toLocaleString("fr-FR")}</p>
                  <p className="text-theme-xs text-gray-500">{h.lots} lot(s)</p>
                </li>
              ))}
              {prof.herd.length === 0 && <li className="col-span-full text-sm text-gray-500">Aucun lot actif : ajoutez les espèces dans « Lots par espèce ».</li>}
            </ul>
          </ComponentCard>
          <ComponentCard title="Contacts, localisation et accès">
            <InfoGrid
              items={[
                { label: "Responsable", value: `${f.managerName} — ${f.managerPhone}` },
                { label: "Contacts", value: f.contacts.map((c) => `${c.name} (${c.relation}) ${c.phone}`).join(" ; ") },
                { label: "Localisation", value: <span className="inline-flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1"><MapPinIcon className="size-4 text-tertiary-500" />{f.location}, {f.region}</span>{maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="rounded-full bg-tertiary-50 px-2 py-0.5 text-[11px] font-medium text-tertiary-700 hover:underline dark:bg-tertiary-500/15 dark:text-tertiary-300">Ouvrir dans Google Maps ↗</a>}</span> },
                { label: "GPS (fictif)", value: f.gps },
                { label: "Accès", value: f.access, wide: true },
              ]}
            />
          </ComponentCard>
        </div>
      )}

      {tab === "lots" && (
        <ComponentCard title="Lots et troupeaux" actions={<Can module="exploitations" action="update"><Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("lot", { species: prof.herd[0]?.species ?? "Volaille" })}>Ajouter un lot</Button></Can>}>
          <DataTable rows={[...f.lots].sort((a, b) => speciesOf(a.species).localeCompare(speciesOf(b.species)))} rowKey={(l) => l.id} columns={[{ key: "s", header: "Espèce", primary: true, render: (l) => <SpeciesIcon species={speciesOf(l.species)} withLabel /> }, { key: "n", header: "Lot", render: (l) => l.name }, { key: "c", header: "Catégorie / âge", render: (l) => [l.category, l.ageRange].filter(Boolean).join(" · ") || "—" }, { key: "d", header: "Mise en place", render: (l) => formatDate(l.startDate) }, { key: "e", header: "Effectif actuel", align: "end", render: (l) => currentHeadcount(f, l.id).toLocaleString("fr-FR") }, { key: "st", header: "Statut", render: (l) => (l.status === "actif" ? "Actif" : "Clôturé") }, { key: "x", header: "", render: (l) => can("exploitations", "update") && <Button size="xs" variant="soft" onClick={() => open("count", { lotId: l.id, count: currentHeadcount(f, l.id), status: l.status })}>Mettre à jour</Button> }]} emptyTitle="Aucun lot" />
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

      {tab === "interventions" && (
        <ComponentCard title="Interventions du cabinet sur l'exploitation" actions={<Can module="exploitations" action="update"><Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={() => open("intervention", { kind: "vaccination", species: prof.herd[0]?.species ?? "Volaille" })}>Enregistrer</Button></Can>}>
          <p className="mb-3 text-theme-xs text-gray-500">Vaccinations, traitements, déparasitages, prélèvements… Le détail clinique reste dans les rapports de visite.</p>
          <DataTable rows={[...(f.interventions ?? [])].sort((a, b) => b.date.localeCompare(a.date))} rowKey={(x) => x.id} columns={[{ key: "d", header: "Date", primary: true, render: (x) => formatDate(x.date) }, { key: "k", header: "Type", render: (x) => INTERVENTION_KINDS.find((k) => k.value === x.kind)?.label ?? x.kind }, { key: "s", header: "Espèce / lot", render: (x) => <span className="inline-flex items-center gap-1"><SpeciesIcon species={x.species} />{x.species}{x.lotId ? ` · ${lotName(x.lotId)}` : ""}</span> }, { key: "c", header: "Animaux", align: "end", render: (x) => x.count.toLocaleString("fr-FR") }, { key: "p", header: "Produit", render: (x) => x.product ?? "—" }, { key: "pb", header: "Problème / résultat", render: (x) => <span className="block max-w-72">{x.problem ?? "—"}{x.lab && <span className="mt-0.5 block text-[11px] text-gray-500">{[x.lab.name, x.lab.test].filter(Boolean).join(" · ")}{x.lab.status === "envoye" ? " · en attente du résultat" : x.lab.result ? ` · ${x.lab.result}` : ""}{x.lab.reportUrl && <> · <a href={x.lab.reportUrl} target="_blank" rel="noopener noreferrer" className="text-tertiary-600 hover:underline">compte rendu ↗</a></>}</span>}</span> }, { key: "b", header: "Par", render: (x) => userName(db, x.byId) }]} emptyTitle="Aucune intervention enregistrée" />
        </ComponentCard>
      )}

      {tab === "history" && <FarmTimeline farm={f} />}

      {tab === "docs" && (
        <ComponentCard title="Rapports et interventions">
          <LinkedDocuments refs={[{ kind: "exploitation", id: f.id }, ...missions.map((m) => ({ kind: "mission" as const, id: m.id }))]} addTo={{ kind: "exploitation", id: f.id }} />
        </ComponentCard>
      )}

      <FarmFormModal isOpen={modal === "edit"} onClose={close} initial={f} onSave={(v) => run(updateFarm, { id: f.id, patch: v }).ok} />
      <AppModal
        isOpen={!!modal && modal !== "edit"}
        onClose={close}
        title={{ intervention: "Intervention du cabinet", lot: "Nouveau lot", count: "Mettre à jour l'effectif", scale: "Catégorie d'éleveur", visit: "Nouvelle visite", edit: "" }[modal ?? "edit"]}
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
          {modal === "intervention" && (
            <>
              <TextField label="Date" type="date" value={s("date")} onChange={set("date")} />
              <SelectField label="Type d'intervention" value={s("kind")} onChange={set("kind")} options={INTERVENTION_KINDS} />
              <SelectField label="Espèce" required value={s("species")} onChange={set("species")} options={(prof.herd.length ? prof.herd.map((h) => h.species) : [...HERD]).map((x) => ({ value: x, label: x }))} />
              <SelectField label="Lot concerné" value={s("lotId")} onChange={set("lotId")} options={f.lots.filter((l) => !s("species") || speciesOf(l.species) === s("species")).map((l) => ({ value: l.id, label: l.name }))} allowEmpty placeholder="Tout l'élevage" />
              <NumberField label="Nombre d'animaux concernés" value={n("count")} onChange={set("count")} min={0} />
              <TextField label="Produit / molécule" value={s("product")} onChange={set("product")} placeholder="Ex. : vaccin Newcastle, ivermectine…" />
              <TextField label={["analyse", "autopsie"].includes(s("kind")) ? "Suspicion / motif" : "Problème observé"} value={s("problem")} onChange={set("problem")} placeholder="Ex. : coccidiose, boiterie…" className="sm:col-span-2" />
              {["analyse", "autopsie", "prelevement"].includes(s("kind")) && (
                <>
                  <TextField label="Laboratoire" value={s("labName")} onChange={set("labName")} placeholder="Ex. : LANADA, labo privé…" />
                  <TextField label="Examen demandé" value={s("labTest")} onChange={set("labTest")} placeholder="Coproscopie, sérologie, bactériologie, lésions…" />
                  <SelectField label="État" value={s("labStatus") || "envoye"} onChange={set("labStatus")} options={[{ value: "envoye", label: "Envoyé / en attente" }, { value: "resultat", label: "Résultat reçu" }]} />
                  <TextField label="Lien du compte rendu (Drive…)" value={s("labUrl")} onChange={set("labUrl")} placeholder="https://drive.google.com/…" />
                  <TextAreaField label={s("kind") === "autopsie" ? "Lésions observées / conclusion" : "Résultat"} value={s("labResult")} onChange={set("labResult")} rows={2} className="sm:col-span-2" />
                </>
              )}
              <TextAreaField label="Note" value={s("note")} onChange={set("note")} rows={2} className="sm:col-span-2" />
            </>
          )}
          {modal === "lot" && (
            <>
              <SelectField label="Espèce" required value={s("species")} onChange={set("species")} options={HERD.map((x) => ({ value: x, label: x }))} />
              <TextField label="Nom du lot" required value={s("name")} onChange={set("name")} placeholder="Ex. : Bande 3, troupeau laitier…" />
              <TextField label="Catégorie" value={s("category")} onChange={set("category")} placeholder="Pondeuses, chair, truies, laitières…" />
              <TextField label="Âge / tranche d'âge" value={s("ageRange")} onChange={set("ageRange")} />
              <TextField label="Date de mise en place" type="date" value={s("date")} onChange={set("date")} />
              <NumberField label="Effectif initial" value={n("count")} onChange={set("count")} min={0} />
            </>
          )}
          {modal === "count" && (
            <>
              <SelectField label="Lot" required value={s("lotId")} onChange={set("lotId")} options={lotOptions} />
              <NumberField label="Effectif actuel" required value={n("count")} onChange={set("count")} min={0} />
              <SelectField label="État du lot" value={s("status")} onChange={set("status")} options={[{ value: "actif", label: "Actif" }, { value: "cloture", label: "Clôturé (vendu, réformé…)" }]} />
            </>
          )}
          {modal === "scale" && (
            <>
              <SelectField label="Catégorie" value={s("scale")} onChange={set("scale")} options={[{ value: "", label: `Automatique (calcul : ${scaleLabel(db, prof.computed)})` }, ...(["petit", "moyen", "gros"] as const).map((k) => ({ value: k, label: scaleLabel(db, k) }))]} className="sm:col-span-2" />
              <TextAreaField label="Pourquoi ce choix ?" value={s("reason")} onChange={set("reason")} rows={2} className="sm:col-span-2" />
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
