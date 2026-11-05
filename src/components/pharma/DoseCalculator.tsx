"use client";

import SpeciesIcon from "@/components/common/SpeciesIcon";
import { PrescriptionModal } from "@/components/prescriptions/PrescriptionModals";
import { useRxDraft, type DraftLine } from "@/components/prescriptions/rxDraft";
import { useRouter } from "@/i18n/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { Link } from "@/i18n/navigation";
import { productStock } from "@/lib/calc";
import { CONC_UNITS, compute, rulesFor, tapeWeight, type ConcUnit } from "@/lib/pharma/compute";
import { rangeText, SPECIES, speciesFromPatient, speciesOf, type SpeciesCode } from "@/lib/pharma/model";
import { allMolecules, productsWith, statusOf, STATUS_LABELS } from "@/lib/pharma/state";
import { indexOnlyMolecules, indexPosologies, vialConc } from "@/lib/pharma/indexPosology";
import { norm } from "@/lib/pharma/model";
import { updateProduct } from "@/lib/services/inventoryService";
import { logCalculation } from "@/lib/services/pharmaService";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";

const inputCls = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:text-white/90";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400";
const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));
const fmt = (n: number, d = 3) => (Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "");

export const ALERT_STYLE = {
  info: "border-tertiary-200 bg-tertiary-25 text-tertiary-800 dark:border-tertiary-800 dark:bg-tertiary-500/10 dark:text-tertiary-200",
  warn: "border-warning-200 bg-warning-25 text-warning-800 dark:border-warning-800 dark:bg-warning-500/10 dark:text-warning-200",
  danger: "border-error-200 bg-error-50 text-error-800 dark:border-error-800 dark:bg-error-500/10 dark:text-error-200",
};

function SpeciesPicker({ value, onChange, available }: { value: SpeciesCode; onChange: (s: SpeciesCode) => void; available?: SpeciesCode[] }) {
  return (
    <div role="radiogroup" aria-label="Espèce" className="flex flex-wrap gap-1.5">
      {SPECIES.map((s) => {
        const off = available && !available.includes(s.code);
        return (
          <button
            key={s.code}
            type="button"
            role="radio"
            aria-checked={value === s.code}
            onClick={() => onChange(s.code)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
              value === s.code ? "border-brand-500 bg-brand-500 text-white" : off ? "border-dashed border-gray-200 text-gray-400 dark:border-gray-700" : "border-gray-200 text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300",
            )}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

function DoseTab() {
  const { db, run, today, establishment, can } = useDemo();
  const router = useRouter();
  const [rxOpen, setRxOpen] = useState(false);
  const [draft, setDraft] = useRxDraft();
  const [withCurrent, setWithCurrent] = useState(true);
  const qMol = useQueryParam("molecule");
  const qSp = useQueryParam("espece") as SpeciesCode | null;
  const qProd = useQueryParam("produit");
  const qPoso = useQueryParam("posologie");
  const qPatient = useQueryParam("patient");
  // Formulaire + posologies de l'index de la clinique + molécules présentes seulement dans l'index.
  const molecules = useMemo(() => {
    const base = allMolecules(db).map((m) => {
      const extra = indexPosologies(db, m);
      return extra.length ? { ...m, posologies: [...m.posologies, ...extra], species: Array.from(new Set([...m.species, ...extra.map((p) => p.species)])) } : m;
    });
    return [...base, ...indexOnlyMolecules(db, base)].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [db]);

  const patient = qPatient ? db.patients.find((p) => p.id === qPatient) : undefined;
  const patientKg = patient ? [...patient.vitals].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg : undefined;
  const [species, setSpecies] = useState<SpeciesCode>(qSp ?? speciesFromPatient(patient?.species) ?? "ch");
  const [molId, setMolId] = useState(qMol ?? "");
  const [search, setSearch] = useState("");
  const [posoId, setPosoId] = useState(qPoso ?? "");
  const [kg, setKg] = useState(patientKg ? String(patientKg) : "");
  const [dose, setDose] = useState("");
  const [productId, setProductId] = useState(qProd ?? "");
  const [conc, setConc] = useState("");
  const [concUnit, setConcUnit] = useState<ConcUnit>("mg/mL");
  const [chest, setChest] = useState("");
  const [lastDose, setLastDose] = useState(today);
  const [meat, setMeat] = useState("");
  const [milk, setMilk] = useState("");
  const [copied, setCopied] = useState(false);
  const [otherQ, setOtherQ] = useState("");
  const [vialVol, setVialVol] = useState("");
  const [basis, setBasis] = useState("");

  const mol = molecules.find((m) => m.id === molId);
  const posos = mol?.posologies.filter((p) => p.species === species) ?? [];
  const poso = posos.find((p) => p.id === posoId) ?? posos[0];
  const products = mol ? productsWith(db, mol.id) : [];
  // Le produit en main peut être n'importe quel article du stock (ex. spécialité humaine à adapter).
  const product = db.products.find((p) => p.id === productId);
  const linked = !!product && products.some((p) => p.id === product.id);
  const otherNeedle = norm(otherQ.trim());
  const otherHits = otherNeedle.length >= 2 ? db.products.filter((p) => p.status === "actif" && !products.some((x) => x.id === p.id) && norm(`${p.name} ${p.brandName ?? ""} ${p.activeIngredient ?? ""}`).includes(otherNeedle)).slice(0, 6) : [];
  const vial = product?.vial;
  const vialMl = Number.isFinite(num(vialVol)) ? num(vialVol) : vial?.volumeMl ?? NaN;
  const basisName = basis || (vial && mol && !/\+/.test(mol.name) ? vial.components.find((c) => norm(c.name).startsWith(norm(mol.name).split(/[\s(]/)[0]))?.name ?? "" : "");
  const sp = speciesOf(species);
  const status = mol ? statusOf(db, mol.id) : "a_valider";

  // Pré-remplissages : dose au centre de la fourchette, concentration du produit sinon de la posologie.
  useEffect(() => {
    if (!poso) return;
    setDose(String(poso.bound === "plafond" ? poso.max : poso.bound === "minimum" ? poso.min : Math.round(((poso.min + poso.max) / 2) * 1000) / 1000));
    if (!product) {
      if (poso.conc) {
        setConc(String(poso.conc.value));
        setConcUnit(poso.conc.unit as ConcUnit);
      } else {
        setConc("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poso?.id]);
  useEffect(() => {
    setVialVol("");
    setBasis("");
    if (product?.vial) {
      const c = vialConc(product.vial, "");
      if (Number.isFinite(c)) {
        setConc(String(Math.round(c * 1000) / 1000));
        setConcUnit("mg/mL");
      }
    } else if (product?.concentration) {
      setConc(String(product.concentration.value));
      setConcUnit(product.concentration.unit);
    }
    setMeat(product?.withdrawalMeatDays != null ? String(product.withdrawalMeatDays) : "");
    setMilk(product?.withdrawalMilkDays != null ? String(product.withdrawalMilkDays) : "");
  }, [product]);
  useEffect(() => {
    if (!kg && sp) setKg(String(sp.defaultKg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species]);

  // Flacon reconstitué : la concentration suit le volume et le principe actif sur lequel porte la dose.
  useEffect(() => {
    if (!vial) return;
    const c = vialConc({ ...vial, volumeMl: vialMl }, basisName);
    if (Number.isFinite(c)) {
      setConc(String(Math.round(c * 1000) / 1000));
      setConcUnit("mg/mL");
    }
  }, [vial, vialMl, basisName]);
  const productInfo = product
    ? {
        routes: product.routes,
        vial: vial && vialMl > 0 ? { volumeMl: vialMl, basisMg: vialConc({ ...vial, volumeMl: vialMl }, basisName) * vialMl, note: vial.note } : undefined,
        components: vial && vialMl > 0 ? vial.components.filter((c) => c.mg > 0).map((c) => ({ name: c.name, mgPerMl: c.mg / vialMl })) : undefined,
      }
    : undefined;
  const result = mol && poso ? compute({ productInfo, molecule: mol, posology: poso, species, kg: num(kg), dose: num(dose), conc: num(conc), concUnit, productName: product?.brandName ?? product?.name, humanProduct: product?.humanUse, withdrawal: sp?.rente ? { lastDose, meatDays: Number.isFinite(num(meat)) ? num(meat) : undefined, milkDays: Number.isFinite(num(milk)) ? num(milk) : undefined } : undefined }) : null;
  const speciesAlerts = mol && !poso ? rulesFor(mol, species) : [];
  const routeUsed = poso ? (product?.routes?.length && result?.alerts.some((a) => /s'administre en/.test(a.text)) ? product.routes.join(", ") : poso.route) : "";
  const currentLine: DraftLine = {
    label: `${mol?.name ?? ""}${product ? ` · ${product.brandName ?? product.name}` : ""} — ${result ? `${result.main} ${result.mainUnit}` : ""}`,
    productId: product?.id ?? "",
    form: product?.form ?? "",
    route: routeUsed,
    quantity: 1,
    dose: result ? `${result.main} ${result.mainUnit} par prise${dose ? ` (${dose} ${poso?.unit ?? ""}${kg ? `, ${kg} kg` : ""})` : ""}` : "",
    frequency: poso?.frequency ?? "",
    duration: "",
    instructions: result?.copy ?? "",
  };

  const needle = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const suggestions = needle.length >= 2 ? molecules.filter((m) => (m.name + " " + m.synonyms.join(" ")).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(needle) || db.products.some((p) => p.composition?.some((c) => c.moleculeId === m.id) && p.name.toLowerCase().includes(needle))).slice(0, 8) : [];

  const copy = async () => {
    if (!result || result.blocked || !mol || !poso) return;
    const text = status === "valide" ? result.copy : `${result.copy}\n(posologie de référence non encore validée par le vétérinaire référent)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      (document.getElementById("calc-copy") as HTMLTextAreaElement | null)?.select();
    }
    run(logCalculation, { moleculeId: mol.id, posologyId: poso.id, species, kg: num(kg), dose: num(dose), productId: product?.id, patientId: patient?.id, result: `${result.main} ${result.mainUnit}`, copied: text }, { silent: true });
  };

  const sliderMin = poso ? (poso.bound === "plafond" ? 0 : poso.min) : 0;
  const sliderMax = poso ? (poso.bound === "minimum" ? poso.min * 3 : poso.max) : 1;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
      <div className="space-y-5 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 lg:col-span-3 dark:border-gray-800 dark:bg-white/3">
        {patient && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
            Patient : <SpeciesIcon species={patient.species} /> <strong>{patient.name}</strong> · {patient.species} · {patientKg ? `${patientKg} kg (dernière pesée)` : "poids non renseigné"}
          </p>
        )}
        <div>
          <span className={labelCls}>Espèce</span>
          <SpeciesPicker value={species} onChange={(s) => { setSpecies(s); setPosoId(""); setKg(""); }} available={mol?.species} />
        </div>

        <div className="relative">
          <label htmlFor="calc-mol" className={labelCls}>Molécule, nom commercial ou produit du stock</label>
          {mol ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
              {mol.id.startsWith("idx-") ? <span className="font-semibold text-gray-800 dark:text-white/90">{mol.name} <span className="text-theme-xs font-normal text-blue-light-600">· index de la clinique</span></span> : <Link href={`/stock/molecules/${mol.id}`} className="font-semibold text-gray-800 hover:underline dark:text-white/90">{mol.name}</Link>}
              {mol.synonyms.length > 0 && <span className="text-theme-xs text-gray-500">{mol.synonyms.join(", ")}</span>}
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status === "valide" ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300")}>{STATUS_LABELS[status]}</span>
              <button type="button" onClick={() => { setMolId(""); setPosoId(""); setProductId(""); setSearch(""); }} className="ms-auto text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Changer</button>
            </div>
          ) : (
            <>
              <input id="calc-mol" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex. : méloxicam, Baytril, paracétamol…" className={inputCls} autoComplete="off" />
              {suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                  {suggestions.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => { setMolId(m.id); setPosoId(""); setProductId(""); }} className="flex w-full items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-start hover:bg-gray-50 dark:hover:bg-white/5">
                        <span className="text-sm font-medium text-gray-800 dark:text-white/90">{m.name}</span>
                        <span className="truncate text-[11px] text-gray-500">{m.species.map((s) => speciesOf(s)?.name).join(", ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {mol && status !== "valide" && (
          <p className="rounded-lg border border-warning-200 bg-warning-25 px-3 py-2 text-theme-xs text-warning-800 dark:border-warning-800 dark:bg-warning-500/10 dark:text-warning-200">
            Fiche non validée : posologie de référence à vérifier sur le RCP avant usage.
          </p>
        )}

        {mol && /lidoca/i.test(`${mol.id} ${mol.name}`) && (
          <p className={cn("rounded-lg border px-3 py-2 text-theme-xs", ALERT_STYLE.info)}>
            <strong>Lidocaïne en perfusion continue (chien)</strong> : bolus 2 mg/kg IV lent, puis 25 à 80 µg/kg/min. Débit (mL/h) = poids × µg/kg/min × 60 ÷ 1000 ÷ concentration (mg/mL). Exemple : 10 kg à 50 µg/kg/min = 30 mg/h, soit 1,5 mL/h de lidocaïne 2 % pure à la seringue électrique. Chez le chat, la perfusion IV est déconseillée (toxicité).
          </p>
        )}

        {mol && posos.length === 0 && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-400">
            Aucune posologie calculable pour {sp?.name.toLowerCase()} dans la base. {mol.species.length > 0 && `Disponible pour : ${mol.species.map((s) => speciesOf(s)?.name).join(", ")}.`}
          </p>
        )}

        {posos.length > 0 && (
          <div>
            <span className={labelCls}>Recommandation pour {sp?.name.toLowerCase()}</span>
            <div className="flex flex-wrap gap-1.5">
              {posos.map((p) => (
                <button key={p.id} type="button" onClick={() => setPosoId(p.id)} aria-pressed={poso?.id === p.id} className={cn("rounded-lg border px-3 py-1.5 text-start text-theme-xs", poso?.id === p.id ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                  <span className={cn("mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", p.id.startsWith("idx-") ? "bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300")}>{p.id.startsWith("idx-") ? "Index de la clinique" : "Formulaire"}</span>
                  <span className="block font-medium">{(p.id.startsWith("idx-") ? p.scheme.replace(/^Index de la clinique( · )?/, "") : p.scheme) || "Standard"}</span>
                  <span className="text-gray-500">{rangeText(p)} · {p.route} · {p.frequency}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {poso && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="calc-kg" className={labelCls}>Poids (kg)</label>
                <input id="calc-kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className={inputCls} />
                {species === "bo" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input aria-label="Tour de poitrine en cm" inputMode="decimal" value={chest} onChange={(e) => setChest(e.target.value)} placeholder="Tour de poitrine (cm)" className={cn(inputCls, "h-9")} />
                    <Button size="xs" variant="soft" onClick={() => num(chest) > 0 && setKg(String(tapeWeight(num(chest) / 100)))}>Ruban → kg</Button>
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="calc-dose" className={labelCls}>
                  Dose ({poso.unit}) <span className="font-normal text-gray-500">· réf. {rangeText(poso)}</span>
                </label>
                <input id="calc-dose" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} className={inputCls} />
                {sliderMax > sliderMin && (
                  <input type="range" aria-label="Ajuster la dose dans la fourchette" min={sliderMin} max={sliderMax} step={(sliderMax - sliderMin) / 100 || 0.01} value={Number.isFinite(num(dose)) ? num(dose) : sliderMin} onChange={(e) => setDose(String(Math.round(Number(e.target.value) * 1000) / 1000))} className="mt-2 w-full accent-brand-500" />
                )}
              </div>
            </div>

            <div>
              <span className={labelCls}>Produit en main</span>
              {products.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {products.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProductId(p.id === productId ? "" : p.id)} aria-pressed={p.id === productId} className={cn("rounded-lg border px-3 py-1.5 text-start text-theme-xs", p.id === productId ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
                      <span className="block font-medium">{p.brandName ?? p.name}{p.humanUse ? " · usage humain" : ""}</span>
                      <span className="text-gray-500">{p.vial ? `flacon ${p.vial.components.map((c) => fmt(c.mg, 0)).join("/")} mg` : p.concentration ? `${fmt(p.concentration.value)} ${p.concentration.unit}` : "concentration à saisir"}{p.routes?.length ? ` · ${p.routes.join(", ")}` : ""} · {establishment ? productStock(db, p.id, establishment.id, today) : 0} en stock</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="relative mb-2">
                <input aria-label="Chercher un autre produit du stock" value={otherQ} onChange={(e) => setOtherQ(e.target.value)} placeholder={products.length ? "Autre produit du stock (ex. spécialité humaine)…" : "Chercher le produit du stock (ex. Genclav)…"} className={cn(inputCls, "h-10")} autoComplete="off" />
                {otherHits.length > 0 && (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                    {otherHits.map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => { setProductId(p.id); setOtherQ(""); }} className="w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                          {p.brandName ?? p.name} <span className="text-theme-xs text-gray-500">{[p.humanUse && "usage humain", p.routes?.join(", "), p.vial ? "flacon à reconstituer" : p.concentration && `${fmt(p.concentration.value)} ${p.concentration.unit}`].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {product && !linked && (
                <div className={cn("mb-2 rounded-lg border px-3 py-2 text-theme-xs", ALERT_STYLE.warn)}>
                  <strong>{product.brandName ?? product.name}</strong> n&apos;est pas relié à {mol?.name}. Vérifiez qu&apos;il contient bien ce principe actif.
                  {can("stock", "update") && mol && !mol.id.startsWith("idx-") && (
                    <button type="button" className="ms-2 font-semibold underline" onClick={() => run(updateProduct, { id: product.id, patch: { composition: [...(product.composition ?? []), { moleculeId: mol.id }] } })}>Relier à cette molécule</button>
                  )}
                </div>
              )}
              {product && (product.routes?.length || product.humanUse) && (
                <p className="mb-2 flex flex-wrap gap-1.5 text-theme-xs">
                  {product.humanUse && <span className="rounded-full bg-warning-50 px-2 py-0.5 font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">Spécialité humaine</span>}
                  {product.routes?.length ? <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">Voie du produit : {product.routes.join(", ")}</span> : null}
                </p>
              )}
              {vial && (
                <div className="mb-2 space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-theme-sm text-gray-700 dark:text-gray-300">Flacon : <strong>{vial.components.map((c) => `${c.name} ${fmt(c.mg, 0)} mg`).join(" + ")}</strong></p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="text-theme-xs text-gray-500">Volume après reconstitution (mL)
                      <input inputMode="decimal" value={Number.isFinite(vialMl) ? (vialVol || String(vialMl)) : vialVol} onChange={(e) => setVialVol(e.target.value)} className={cn(inputCls, "mt-1 h-9")} />
                    </label>
                    {vial.components.length > 1 && (
                      <label className="text-theme-xs text-gray-500">La dose recommandée porte sur
                        <select value={basisName} onChange={(e) => setBasis(e.target.value)} className={cn(inputCls, "mt-1 h-9")}>
                          <option value="">l&apos;association ({fmt(vial.components.reduce((s, c) => s + c.mg, 0), 0)} mg)</option>
                          {vial.components.map((c) => <option key={c.name} value={c.name}>{c.name} seul(e) ({fmt(c.mg, 0)} mg)</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input aria-label="Concentration" inputMode="decimal" value={conc} onChange={(e) => setConc(e.target.value)} placeholder="Concentration" className={inputCls} />
                <select aria-label="Unité de concentration" value={concUnit} onChange={(e) => setConcUnit(e.target.value as ConcUnit)} className={cn(inputCls, "w-36")}>
                  {CONC_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{product ? (vial ? "Concentration du flacon reconstitué, calculée automatiquement." : "Concentration du produit en stock.") : poso.conc ? `Présentation courante : ${poso.conc.label || `${poso.conc.value} ${poso.conc.unit}`}. Choisissez un produit du stock pour sa concentration réelle.` : "Saisissez la concentration du produit (1 % = 10 mg/mL)."}</p>
            </div>

            {sp?.rente && (
              <fieldset className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-3 dark:border-gray-700">
                <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Délais d&apos;attente (étiquette du produit)</legend>
                <div>
                  <label htmlFor="calc-last" className="mb-1 block text-theme-xs text-gray-500">Dernière administration</label>
                  <input id="calc-last" type="date" value={lastDose} onChange={(e) => setLastDose(e.target.value)} className={cn(inputCls, "h-9")} />
                </div>
                <div>
                  <label htmlFor="calc-meat" className="mb-1 block text-theme-xs text-gray-500">Viande (jours)</label>
                  <input id="calc-meat" inputMode="numeric" value={meat} onChange={(e) => setMeat(e.target.value)} className={cn(inputCls, "h-9")} />
                </div>
                <div>
                  <label htmlFor="calc-milk" className="mb-1 block text-theme-xs text-gray-500">Lait (jours)</label>
                  <input id="calc-milk" inputMode="numeric" value={milk} onChange={(e) => setMilk(e.target.value)} className={cn(inputCls, "h-9")} />
                </div>
              </fieldset>
            )}
          </>
        )}
      </div>

      <div className="space-y-3 lg:col-span-2">
        <section aria-live="polite" className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 lg:sticky lg:top-24 dark:border-gray-800 dark:bg-white/3">
          {!result ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Choisissez l&apos;espèce et la molécule, puis saisissez le poids : le résultat s&apos;affiche ici.</p>
              {speciesAlerts.map((a, i) => (
                <p key={i} className={cn("rounded-lg border px-3 py-2 text-theme-xs", ALERT_STYLE[a.level])}>{a.text}</p>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">{result.label}</p>
              {poso && !result.blocked && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                    <p className="text-[11px] font-medium text-gray-500">Recommandation ({poso.id.startsWith("idx-") ? "index de la clinique" : "formulaire"})</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">{fmt(num(dose))} {poso.unit} → {fmt(result.amount)} {poso.unit.split("/")[0]}</p>
                    <p className="text-[11px] text-gray-500">{poso.route} · {poso.frequency}</p>
                  </div>
                  <div className="rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-500/10">
                    <p className="text-[11px] font-medium text-brand-700 dark:text-brand-300">Produit en main</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{product ? product.brandName ?? product.name : "Aucun produit choisi"}</p>
                    <p className="text-[11px] text-gray-500">{product ? [conc && `${conc} ${concUnit}`, product.routes?.join(", ")].filter(Boolean).join(" · ") : "Choisissez le produit pour adapter la dose"}</p>
                  </div>
                </div>
              )}
              {result.blocked ? (
                <p className="text-xl font-semibold text-error-600 dark:text-error-400">Calcul bloqué</p>
              ) : (
                <p className={cn("text-4xl leading-none font-semibold tabular-nums", result.status === "ok" ? "text-gray-900 dark:text-white" : result.status === "limite" ? "text-error-600 dark:text-error-400" : "text-warning-600 dark:text-warning-400")}>
                  {result.main} <span className="text-xl font-medium">{result.mainUnit}</span>
                </p>
              )}
              {!result.blocked && <p className="text-sm text-gray-600 dark:text-gray-400">{result.sub}</p>}
              {!result.blocked && result.rows.length > 0 && (
                <dl className="divide-y divide-gray-100 border-y border-gray-100 text-sm dark:divide-gray-800 dark:border-gray-800">
                  {result.rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 py-1.5">
                      <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
                      <dd className="text-end font-medium text-gray-800 tabular-nums dark:text-white/90">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {result.alerts.map((a, i) => (
                <p key={i} className={cn("rounded-lg border px-3 py-2 text-theme-xs", ALERT_STYLE[a.level])}>{a.text}</p>
              ))}
              {!result.blocked && (
                <>
                  <textarea id="calc-copy" readOnly value={result.copy} rows={6} aria-label="Texte pour l'ordonnance" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-theme-xs text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button size="sm" variant="outline" onClick={copy}>{copied ? "Copié et enregistré" : "Copier (WhatsApp)"}</Button>
                    {can("prescriptions", "create") && <Button size="sm" variant="soft" onClick={() => { setDraft([...draft, currentLine]); void copy(); }}>Ajouter à l&apos;ordonnance</Button>}
                    {can("prescriptions", "create") && <Button size="sm" className="sm:col-span-2" onClick={() => { void copy(); setWithCurrent(!draft.some((l) => l.instructions === currentLine.instructions)); setRxOpen(true); }}>{draft.length ? `Créer l'ordonnance (${draft.length + (draft.some((l) => l.instructions === currentLine.instructions) ? 0 : 1)} médicaments)` : "Créer l'ordonnance"}</Button>}
                  </div>
                  <PrescriptionModal
                    isOpen={rxOpen}
                    onClose={() => setRxOpen(false)}
                    patientId={patient?.id ?? ""}
                    presetLines={[...draft, ...(withCurrent ? [currentLine] : [])]}
                    onCreated={() => { setDraft([]); router.push(patient ? `/patients/${patient.id}` : "/prescriptions"); }}
                  />
                </>
              )}
              <p className="text-[11px] text-gray-400">Aide au calcul : le module ne prescrit pas. La décision reste au vétérinaire.</p>
            </div>
          )}
        </section>
        {draft.length > 0 && (
          <section className="rounded-3xl border border-brand-200 bg-brand-25 p-4 dark:border-brand-800 dark:bg-brand-500/5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Ordonnance en cours · {draft.length} médicament(s)</h3>
              <button type="button" onClick={() => setDraft([])} className="text-theme-xs font-medium text-gray-500 hover:underline">Vider</button>
            </div>
            <ol className="space-y-1.5">
              {draft.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded-xl bg-white px-3 py-2 text-theme-sm dark:bg-white/5">
                  <span className="min-w-0 text-gray-700 dark:text-gray-300"><strong className="text-gray-800 dark:text-white/90">{i + 1}.</strong> {l.label}{!l.productId && <span className="block text-theme-xs text-warning-600">produit à choisir sur l&apos;ordonnance</span>}</span>
                  <button type="button" aria-label="Retirer de l'ordonnance" onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-white/5">×</button>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-gray-500">Changez de molécule ou de produit, calculez, puis « Ajouter à l&apos;ordonnance ». Tout est enregistré ensemble avec « Créer l&apos;ordonnance ».</p>
            {can("prescriptions", "create") && !result && <Button size="sm" className="mt-2 w-full" onClick={() => { setWithCurrent(false); setRxOpen(true); }}>Créer l&apos;ordonnance ({draft.length})</Button>}
          </section>
        )}
        {!result && (
          <PrescriptionModal isOpen={rxOpen} onClose={() => setRxOpen(false)} patientId={patient?.id ?? ""} presetLines={draft} onCreated={() => { setDraft([]); router.push(patient ? `/patients/${patient.id}` : "/prescriptions"); }} />
        )}
      </div>
    </div>
  );
}

export default function DoseCalculator() {
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Calculateur de dose" subtitle="Posologies de l'Index des molécules · mg, mL, comprimés, UI, eau de boisson" trail={[{ label: "Pharmacie", href: "/stock" }, { label: "Index des molécules", href: "/stock/molecules" }]} />
      <DoseTab />
    </div>
  );
}
