"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField } from "@/components/form/Field";
import { useDemo } from "@/context/DemoStoreContext";
import { AlertTriangleIcon } from "@/icons";
import { formatDate } from "@/lib/format";
import { useMemo, useState } from "react";

/**
 * Calculateur d'aide au conseil — n'utilise QUE les dosages documentés dans la
 * fiche produit (notice). Aucune posologie n'est inventée ni extrapolée ; toute
 * adaptation thérapeutique exige la validation du vétérinaire responsable.
 */
export default function DoseCalculatorPage() {
  const { db, today, user } = useDemo();
  const [productId, setProductId] = useState("");
  const [species, setSpecies] = useState("");
  const [weight, setWeight] = useState(NaN);
  const [count, setCount] = useState(NaN);
  const [container, setContainer] = useState(NaN);

  const products = db.products.filter((p) => p.status === "actif");
  const product = products.find((p) => p.id === productId);
  const dosage = product?.dosage;

  const missing: string[] = [];
  if (!product) missing.push("un produit");
  if (product && !dosage) missing.push("un dosage documenté dans la fiche produit");
  if (!(weight > 0)) missing.push("le poids d'un animal (kg)");
  if (!(count > 0)) missing.push("le nombre d'animaux");

  const speciesMismatch = dosage?.species && species && !dosage.species.toLowerCase().includes(species.toLowerCase().slice(0, 4));
  const humanUseBlock = product?.humanUse;

  const result = useMemo(() => {
    if (missing.length || !dosage || speciesMismatch || humanUseBlock) return null;
    const perAnimal = dosage.perKg * weight; // en unité de dosage
    const total = perAnimal * count;
    return { perAnimal, total, perContainer: container > 0 ? total * container : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dosage, weight, count, container, speciesMismatch, humanUseBlock, productId]);

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Calculateur d'aide au conseil" subtitle="Préparation d'informations pour les élevages — à valider par le vétérinaire" trail={[{ label: "Stock", href: "/stock" }]} />
      <DemoNotice tone="warning">
        <strong>Aide au calcul, pas un prescripteur.</strong> Seuls les dosages documentés dans les fiches produits sont utilisés — rien n&apos;est inventé ni extrapolé d&apos;une posologie humaine. Les produits à usage humain sont bloqués. Toute prescription ou adaptation thérapeutique doit être validée par un vétérinaire habilité ; le profil « {user?.title ?? "assistant"} » ne peut pas valider seul un traitement.
      </DemoNotice>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <ComponentCard title="Paramètres">
          <FormGrid>
            <SelectField
              label="Produit"
              required
              value={productId}
              onChange={setProductId}
              allowEmpty
              placeholder="Sélectionner un produit"
              options={products.map((p) => ({ value: p.id, label: `${p.name}${p.dosage ? "" : " — pas de dosage documenté"}${p.humanUse ? " — usage humain" : ""}` }))}
            />
            <SelectField label="Espèce" required value={species} onChange={setSpecies} allowEmpty placeholder="Sélectionner" options={["Chien", "Chat", "Bovin", "Ovin", "Caprin", "Porc", "Volaille", "Lapin", "Équidé", "Autre"].map((s) => ({ value: s, label: s }))} />
            <NumberField label="Poids d'un animal" suffix="kg" required value={weight} onChange={setWeight} min={0} step={0.1} />
            <NumberField label="Nombre d'animaux" required value={count} onChange={setCount} min={1} />
            <NumberField label="Récipient / abreuvoir (optionnel)" suffix="L ou dose" value={container} onChange={setContainer} min={0} hint="Volume de référence pour la conversion pratique" />
          </FormGrid>
        </ComponentCard>

        <ComponentCard title="Résultat">
          {product && (
            <div className="mb-3 space-y-1 rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/3">
              <p className="font-medium text-gray-800 dark:text-white/90">{product.name} <span className="text-theme-xs text-gray-500">({product.form})</span></p>
              {product.activeIngredient && <p className="text-theme-xs text-gray-500">Principe actif : {product.activeIngredient}</p>}
              {dosage ? <p className="text-theme-xs text-brand-700 dark:text-brand-400">Dosage documenté : {dosage.perKg} {dosage.unit}{dosage.species ? ` — ${dosage.species}` : ""}{dosage.note ? ` · ${dosage.note}` : ""}</p> : <p className="text-theme-xs text-warning-600">Aucun dosage structuré documenté pour ce produit.</p>}
              {product.contraIndications && <p className="text-theme-xs text-error-600">Contre-indications : {product.contraIndications}</p>}
            </div>
          )}

          {humanUseBlock ? (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-400">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              Produit à usage humain : le calculateur est désactivé — aucune posologie humaine ne peut être extrapolée à un animal sans référence vétérinaire validée.
            </div>
          ) : speciesMismatch ? (
            <div className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              L&apos;espèce sélectionnée ne correspond pas aux espèces documentées ({dosage?.species}). Aucun calcul proposé.
            </div>
          ) : missing.length ? (
            <p className="text-sm text-gray-500">Renseignez : {missing.join(", ")}.</p>
          ) : result ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-500/10">
                  <p className="text-theme-xs text-gray-500">Dose par animal</p>
                  <p className="text-lg font-semibold text-brand-700 dark:text-brand-400">{Math.round(result.perAnimal * 1000) / 1000} {dosage!.unit.split("/")[0]}</p>
                </div>
                <div className="rounded-xl bg-tertiary-50 p-3 dark:bg-tertiary-500/10">
                  <p className="text-theme-xs text-gray-500">Dose totale ({count} animaux)</p>
                  <p className="text-lg font-semibold text-tertiary-700 dark:text-tertiary-400">{Math.round(result.total * 1000) / 1000} {dosage!.unit.split("/")[0]}</p>
                </div>
              </div>
              {result.perContainer != null && <p className="text-sm text-gray-600 dark:text-gray-400">Conversion pratique : ≈ <strong>{Math.round(result.perContainer * 1000) / 1000} {dosage!.unit.split("/")[0]}</strong> par récipient de référence.</p>}
              <p className="flex items-start gap-1.5 text-theme-xs text-gray-500">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning-500" />
                Calcul indicatif basé sur la notice — vérifiez la notice réelle et faites valider par le vétérinaire responsable avant toute application ({formatDate(today)}).
              </p>
            </div>
          ) : null}
        </ComponentCard>
      </div>

      <ComponentCard title="Notices des produits avec dosage documenté">
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {products.filter((p) => p.dosage).map((p) => (
            <li key={p.id} className="rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
              <span className="font-medium">{p.name}</span> — {p.dosage!.perKg} {p.dosage!.unit}
              {p.dosage!.species && <span className="ms-1 text-theme-xs text-gray-500">{p.dosage!.species}</span>}
            </li>
          ))}
        </ul>
      </ComponentCard>
    </div>
  );
}
