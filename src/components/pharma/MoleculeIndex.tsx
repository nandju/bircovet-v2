"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { formatDateTime } from "@/lib/format";
import { FAMILIES, familyName, INTERACTIONS, norm, REFERENCES, searchText, SPECIES, speciesOf, type SpeciesCode } from "@/lib/pharma/model";
import { allMolecules, pharmaOf, productsWith, statusOf, STATUS_LABELS } from "@/lib/pharma/state";
import type { MoleculeStatus } from "@/lib/types";
import { cn } from "@/utils";
import { useMemo, useState } from "react";
import MoleculeFormModal from "./MoleculeFormModal";

export const STATUS_CHIP: Record<MoleculeStatus, string> = {
  brouillon: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  a_valider: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300",
  valide: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300",
  retire: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300",
};

function IndexTab() {
  const { db, can } = useDemo();
  const [q, setQ] = useState("");
  const [sp, setSp] = useState<SpeciesCode | "">("");
  const [fam, setFam] = useState("");
  const [st, setSt] = useState<MoleculeStatus | "">("");
  const [inStock, setInStock] = useState(false);
  const [create, setCreate] = useState(false);
  const molecules = useMemo(() => allMolecules(db), [db]);
  const index = useMemo(() => molecules.map((m) => ({ m, text: searchText(m, productsWith(db, m.id).map((p) => `${p.name} ${p.brandName ?? ""}`)) })), [molecules, db]);
  const needle = norm(q.trim());
  const list = index.filter(({ m, text }) => (!needle || text.includes(needle)) && (!sp || m.species.includes(sp)) && (!fam || m.family === fam) && (!st || statusOf(db, m.id) === st) && (!inStock || productsWith(db, m.id).length > 0)).map((x) => x.m);
  const counts = { total: molecules.length, posos: molecules.reduce((s, m) => s + m.posologies.length, 0), valid: molecules.filter((m) => statusOf(db, m.id) === "valide").length };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong className="text-gray-800 tabular-nums dark:text-white/90">{counts.total}</strong> molécules · <strong className="text-gray-800 tabular-nums dark:text-white/90">{counts.posos}</strong> posologies calculables · <strong className="text-gray-800 tabular-nums dark:text-white/90">{counts.valid}</strong> validées
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/stock/calculateur" className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Calculateur</Link>
          {can("stock", "update") && (
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => setCreate(true)}>Nouvelle fiche</Button>
          )}
        </div>
      </div>
      <div className="space-y-3 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Molécule, nom commercial, produit du stock, indication, effet…" aria-label="Rechercher" className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90" />
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setSp("")} aria-pressed={!sp} className={cn("rounded-full border px-3 py-1 text-theme-xs font-medium", !sp ? "border-gray-800 bg-gray-800 text-white dark:border-white/20 dark:bg-white/15" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400")}>Toutes espèces</button>
          {SPECIES.map((s) => (
            <button key={s.code} onClick={() => setSp(s.code === sp ? "" : s.code)} aria-pressed={sp === s.code} className={cn("rounded-full border px-3 py-1 text-theme-xs font-medium", sp === s.code ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400")}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Famille" className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
            <option value="">Toutes les familles</option>
            {FAMILIES.map((f) => (
              <option key={f.code} value={f.code}>{f.name}</option>
            ))}
          </select>
          <select value={st} onChange={(e) => setSt(e.target.value as MoleculeStatus | "")} aria-label="Statut" className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABELS) as MoleculeStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 rounded border-gray-300" />
            Présentes dans le stock
          </label>
          <span className="ms-auto text-theme-xs text-gray-500">{list.length} résultat(s)</span>
        </div>
      </div>

      <ul className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
        {list.slice(0, 120).map((m) => {
          const s = statusOf(db, m.id);
          const prods = productsWith(db, m.id);
          return (
            <li key={m.id} className="border-t border-gray-100 first:border-t-0 dark:border-gray-800">
              <Link href={`/stock/molecules/${m.id}${sp ? `?espece=${sp}` : ""}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-gray-50 sm:px-5 dark:hover:bg-white/3">
                <span className="min-w-0 flex-1 basis-56">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">{m.name}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", STATUS_CHIP[s])}>{STATUS_LABELS[s]}</span>
                    {m.amm && <span className="rounded-full bg-tertiary-50 px-1.5 py-0.5 text-[11px] font-medium text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300">AMM espèce</span>}
                    {m.anecdotal && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-400">Anecdotique</span>}
                    {prods.length > 0 && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{prods.length} produit(s) en stock</span>}
                  </span>
                  <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                    {familyName(m.family)}
                    {m.synonyms.length ? ` · ${m.synonyms.join(", ")}` : ""}
                    {m.fiches[0]?.indications ? ` · ${m.fiches[0].indications}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {m.species.map((c) => (
                    <span key={c} className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", m.posologies.some((p) => p.species === c) ? "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" : "text-gray-400")}>{speciesOf(c)?.name}</span>
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-5 py-8 text-center text-sm text-gray-500">Aucune molécule. Créez une fiche si elle manque à la base.</li>}
      </ul>
      {list.length > 120 && <p className="text-theme-xs text-gray-500">120 premiers résultats affichés : affinez la recherche.</p>}
      <MoleculeFormModal isOpen={create} onClose={() => setCreate(false)} />
    </div>
  );
}

function InteractionsTab() {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-start text-theme-xs text-gray-500">
              <th className="px-4 py-3 text-start font-medium">Situation</th>
              <th className="px-4 py-3 text-start font-medium">Médicaments concernés</th>
              <th className="px-4 py-3 text-start font-medium">Risque</th>
              <th className="px-4 py-3 text-start font-medium">Surveillance</th>
            </tr>
          </thead>
          <tbody>
            {INTERACTIONS.map((x, i) => (
              <tr key={i} className="border-t border-gray-100 align-top dark:border-gray-800">
                <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-white/90">{x.situation}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{x.medicaments}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{x.risque}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{x.surveillance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 dark:border-gray-800 dark:bg-white/3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Références</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {REFERENCES.map((r, i) => (
            <li key={i} className="text-gray-700 dark:text-gray-300">
              <strong>{r.titre}</strong> — {r.domaine}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LogTab() {
  const { db } = useDemo();
  const log = pharmaOf(db).calcLog;
  const molecules = allMolecules(db);
  if (!log.length) return <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Aucun calcul enregistré. Chaque texte copié depuis le calculateur est tracé ici.</p>;
  return (
    <div className="overflow-x-auto rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="text-theme-xs text-gray-500">
            {["Date", "Utilisateur", "Molécule", "Espèce · poids", "Dose", "Résultat", "Patient"].map((h) => (
              <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {log.map((l) => (
            <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 tabular-nums">{formatDateTime(l.date)}</td>
              <td className="px-4 py-2">{db.users.find((u) => u.id === l.userId)?.name}</td>
              <td className="px-4 py-2">{molecules.find((m) => m.id === l.moleculeId)?.name ?? l.moleculeId}</td>
              <td className="px-4 py-2">{speciesOf(l.species)?.name} · {l.kg} kg</td>
              <td className="px-4 py-2 tabular-nums">{l.dose}</td>
              <td className="px-4 py-2 font-medium tabular-nums">{l.result}</td>
              <td className="px-4 py-2">{l.patientId ? db.patients.find((p) => p.id === l.patientId)?.name : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MoleculeIndex() {
  const [tab, setTab] = useState<"index" | "inter" | "log">("index");
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Index des molécules" subtitle="Posologies par espèce, contre-indications, alertes — base Formulaire BIRCOVET" trail={[{ label: "Pharmacie", href: "/stock" }]} />
      <Tabs tabs={[{ key: "index", label: "Molécules" }, { key: "inter", label: "Interactions et références" }, { key: "log", label: "Journal des calculs" }]} active={tab} onChange={(k) => setTab(k as typeof tab)} />
      {tab === "index" && <IndexTab />}
      {tab === "inter" && <InteractionsTab />}
      {tab === "log" && <LogTab />}
    </div>
  );
}
