"use client";

import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField, TextAreaField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { formatXOF } from "@/lib/format";
import { saveOffer } from "@/lib/services/platformService";
import type { PlatformOffer } from "@/lib/types";
import { useState } from "react";

export default function OfferPage() {
  const { db, run } = useDemo();
  const [v, setV] = useState<PlatformOffer>(() => ({ ...db.platform!.offer }));
  const [n, setN] = useState(10);
  const yearly = v.maintenancePeriod === "annuel" ? v.maintenanceAmount : v.maintenanceAmount * 12;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Offre Cliva" subtitle="Vente directe de la licence, puis petite maintenance : les valeurs par défaut des nouvelles cliniques" trail={[{ label: "Console éditeur", href: "/editeur" }]} actions={<Button size="sm" onClick={() => run(saveOffer, v)}>Enregistrer</Button>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ComponentCard title="Conditions par défaut" desc="Chaque clinique garde ses propres montants négociés (fiche clinique).">
          <FormGrid>
            <NumberField label="Prix de la licence (vente directe)" suffix="FCFA" value={v.licencePrice} onChange={(x) => setV({ ...v, licencePrice: x })} min={0} step={100000} hint="Ex. : 3 000 000 à 4 000 000 FCFA" />
            <NumberField label="Maintenance" suffix="FCFA" value={v.maintenanceAmount} onChange={(x) => setV({ ...v, maintenanceAmount: x })} min={0} step={5000} />
            <SelectField label="Rythme de la maintenance" value={v.maintenancePeriod} onChange={(x) => setV({ ...v, maintenancePeriod: x as PlatformOffer["maintenancePeriod"] })} options={[{ value: "mensuel", label: "Mensuelle" }, { value: "annuel", label: "Annuelle" }]} />
            <NumberField label="Tolérance après échéance" suffix="jours" value={v.graceDays} onChange={(x) => setV({ ...v, graceDays: x })} min={0} />
            <TextAreaField label="Ce que couvre la maintenance (pour le contrat)" value={v.notes} onChange={(x) => setV({ ...v, notes: x })} rows={4} className="sm:col-span-2" />
          </FormGrid>
          <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-theme-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
            Principe retenu : la clinique achète sa licence et garde la main sur ses données, même si la maintenance n&apos;est plus payée. Sans maintenance, elle perd les mises à jour et l&apos;assistance ; un rappel discret s&apos;affiche chez son DG, sans blocage. Les publicités Cliva restent toujours affichées.
          </p>
        </ComponentCard>
        <ComponentCard title="Simulation" desc="Pour se projeter, à affiner avec le vrai prix.">
          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">Cliniques vendues
            <input type="range" min={1} max={100} value={n} onChange={(e) => setN(Number(e.target.value))} className="flex-1 accent-brand-500" aria-label="Nombre de cliniques" />
            <span className="w-10 text-end font-semibold tabular-nums">{n}</span>
          </label>
          <dl className="mt-4 divide-y divide-gray-100 text-sm dark:divide-gray-800">
            {[["Ventes de licences (une fois)", n * v.licencePrice], ["Maintenance par an", n * yearly], ["Total première année", n * (v.licencePrice + yearly)], ["Puis chaque année (maintenance)", n * yearly]].map(([l, x]) => (
              <div key={l as string} className="flex justify-between py-2"><dt className="text-gray-600 dark:text-gray-400">{l}</dt><dd className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatXOF(x as number)}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-gray-500">Hors recettes publicitaires et hors coûts d&apos;hébergement et d&apos;assistance.</p>
        </ComponentCard>
      </div>
    </div>
  );
}
