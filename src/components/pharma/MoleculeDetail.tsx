"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { TextAreaField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { Link } from "@/i18n/navigation";
import { productStock } from "@/lib/calc";
import { rulesFor } from "@/lib/pharma/compute";
import { familyName, FAMILIES, rangeText, SOURCES, speciesOf, type SpeciesCode } from "@/lib/pharma/model";
import { findMolecule, pharmaOf, productsWith, statusOf, STATUS_LABELS } from "@/lib/pharma/state";
import { formatDateTime } from "@/lib/format";
import { setMoleculeStatus } from "@/lib/services/pharmaService";
import type { MoleculeStatus } from "@/lib/types";
import { entriesForMolecule } from "@/lib/drugIndex";
import { cn } from "@/utils";
import { useState } from "react";
import { ALERT_STYLE } from "./DoseCalculator";
import MoleculeFormModal from "./MoleculeFormModal";
import { STATUS_CHIP } from "./MoleculeIndex";

export default function MoleculeDetail({ id }: { id: string }) {
  const { db, user, run, today, establishment } = useDemo();
  const qSp = useQueryParam("espece") as SpeciesCode | null;
  const m = findMolecule(db, id);
  const [sp, setSp] = useState<SpeciesCode | null>(qSp && m?.species.includes(qSp) ? qSp : (m?.species[0] ?? null));
  const [statusTo, setStatusTo] = useState<MoleculeStatus | null>(null);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(false);
  if (!m) return <p className="text-sm text-gray-500">Molécule introuvable.</p>;
  const ph = pharmaOf(db);
  const state = ph.states[m.id];
  const status = statusOf(db, m.id);
  const referent = !!user && ph.referentIds.includes(user.id);
  const products = productsWith(db, m.id);
  const posos = m.posologies.filter((p) => p.species === sp);
  const fiches = m.fiches.filter((f) => !sp || f.species.includes(sp));
  const rules = sp ? rulesFor(m, sp) : [];
  const family = FAMILIES.find((f) => f.code === m.family);
  const isDraft = ph.drafts.some((d) => d.id === m.id);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={m.name}
        subtitle={`${familyName(m.family)}${m.synonyms.length ? ` · ${m.synonyms.join(", ")}` : ""}`}
        trail={[{ label: "Pharmacie", href: "/stock" }, { label: "Index des molécules", href: "/stock/molecules" }]}
        actions={
          <>
            {isDraft && <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Modifier la fiche</Button>}
            <Link href={`/stock/calculateur?molecule=${m.id}${sp ? `&espece=${sp}` : ""}`} className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">Calculer une dose</Link>
          </>
        }
      />

      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3", status === "valide" ? "border-success-200 bg-success-25 dark:border-success-800 dark:bg-success-500/10" : "border-warning-200 bg-warning-25 dark:border-warning-800 dark:bg-warning-500/10")}>
        <span className={cn("rounded-full px-2 py-0.5 text-theme-xs font-semibold", STATUS_CHIP[status])}>{STATUS_LABELS[status]}</span>
        <span className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-300">
          {status === "valide" && state?.validatedById ? `Validée par ${db.users.find((u) => u.id === state.validatedById)?.name} le ${formatDateTime(state.validatedAt!)}.` : status === "retire" ? "Fiche retirée : ne plus utiliser." : "Non validée : les posologies sont des références à vérifier sur le RCP avant usage."}
          {state ? ` Version ${state.version}.` : ""}
        </span>
        {referent ? (
          <span className="flex flex-wrap gap-1.5">
            {status !== "valide" && <Button size="xs" onClick={() => setStatusTo("valide")}>Valider la fiche</Button>}
            {status === "brouillon" && <Button size="xs" variant="soft" onClick={() => setStatusTo("a_valider")}>Envoyer en validation</Button>}
            {status !== "retire" && <Button size="xs" variant="ghost" onClick={() => setStatusTo("retire")}>Retirer</Button>}
          </span>
        ) : (
          <span className="text-theme-xs text-gray-500">Validation réservée aux vétérinaires référents.</span>
        )}
      </div>

      <div role="tablist" aria-label="Espèce" className="flex flex-wrap gap-1.5">
        {m.species.map((c) => (
          <button key={c} role="tab" aria-selected={sp === c} onClick={() => setSp(c)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", sp === c ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")}>
            {speciesOf(c)?.name}
            <span className="ms-1 text-theme-xs opacity-70">{m.posologies.filter((p) => p.species === c).length}</span>
          </button>
        ))}
      </div>

      {rules.map((a, i) => (
        <p key={i} className={cn("rounded-xl border px-4 py-3 text-sm", ALERT_STYLE[a.level])}>{a.text}</p>
      ))}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <section className="min-w-0 rounded-3xl border border-gray-200/70 bg-white shadow-cliva lg:col-span-2 dark:border-gray-800 dark:bg-white/3">
          <h2 className="px-4 pt-4 pb-2 text-base font-semibold text-gray-800 sm:px-5 dark:text-white/90">Posologies · {sp ? speciesOf(sp)?.name : ""}</h2>
          {posos.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-gray-500">Pas de posologie calculable pour cette espèce (protocole spécifique ou texte seul ci-dessous).</p>
          ) : (
            <ul>
              {posos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 sm:px-5 dark:border-gray-800">
                  <span className="min-w-0 flex-1 basis-56">
                    <span className="block text-sm font-semibold text-gray-800 tabular-nums dark:text-white/90">{rangeText(p)}</span>
                    <span className="block text-theme-xs text-gray-600 dark:text-gray-400">
                      {p.scheme ? `${p.scheme} · ` : ""}
                      {p.route} · {p.frequency}
                      {p.conc ? ` · présentation ${p.conc.label || `${p.conc.value} ${p.conc.unit}`}` : ""}
                    </span>
                    {p.alert && <span className={cn("mt-1 inline-block rounded-md border px-2 py-0.5 text-[11px]", ALERT_STYLE[p.alert.level])}>{p.alert.text}</span>}
                  </span>
                  <Link href={`/stock/calculateur?molecule=${m.id}&espece=${p.species}&posologie=${p.id}`} className="rounded-lg bg-brand-50 px-3 py-1.5 text-theme-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300">Calculer</Link>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-4 border-t border-gray-100 px-4 py-4 sm:px-5 dark:border-gray-800">
            {fiches.map((f) => (
              <div key={f.ficheId} className="space-y-1.5 text-sm">
                {fiches.length > 1 && <p className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">{f.title}</p>}
                <p className="text-gray-800 dark:text-gray-200"><span className="text-gray-500">Posologie de référence : </span>{f.posologyText}</p>
                {f.indications && <p className="text-gray-800 dark:text-gray-200"><span className="text-gray-500">Indications : </span>{f.indications}</p>}
                {f.contraindications && <p className="text-gray-800 dark:text-gray-200"><span className="text-gray-500">Contre-indications et effets : </span>{f.contraindications}</p>}
                {f.withdrawal && <p className="text-gray-800 dark:text-gray-200"><span className="text-gray-500">Délai d&apos;attente indicatif : </span>{f.withdrawal} <span className="text-theme-xs text-gray-500">(le délai réel vient de l&apos;étiquette du produit)</span></p>}
                <p className="text-theme-xs text-gray-500">Source : {SOURCES[f.source] ?? f.source}{f.amm ? " · AMM pour l'espèce" : ""}{f.anecdotal ? " · dose anecdotique" : ""}</p>
              </div>
            ))}
            {family?.note && <p className={cn("rounded-lg border px-3 py-2 text-theme-xs", ALERT_STYLE.info)}>{family.name} : {family.note}</p>}
          </div>
        </section>

        <div className="space-y-4">
          {entriesForMolecule(db, m.name).length > 0 && (
            <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 dark:border-gray-800 dark:bg-white/3">
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Index thérapeutique de la clinique</h2>
              <ul className="mt-2 space-y-2">
                {entriesForMolecule(db, m.name).map((e) => (
                  <li key={e.id} className="rounded-xl bg-gray-50 px-3 py-2 text-theme-sm dark:bg-white/5">
                    <p className="font-medium text-gray-800 dark:text-white/90">{e.species} · {e.indication ?? e.molecule}</p>
                    <p className="text-gray-700 dark:text-gray-300">{[e.dosage, e.route, e.amm && `AMM ${e.amm.toLowerCase()}`].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
              <Link href="/stock/index-therapeutique" className="mt-2 inline-block text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400">Ouvrir l&apos;index</Link>
            </section>
          )}
          <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 dark:border-gray-800 dark:bg-white/3">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Produits du stock</h2>
            {products.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Aucun produit relié. Reliez un article depuis sa fiche (Pharmacie → Catalogue).</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/stock/articles/${p.id}`} className="block truncate font-medium text-gray-800 hover:underline dark:text-white/90">{p.brandName ?? p.name}</Link>
                      <span className="text-theme-xs text-gray-500">{p.concentration ? `${p.concentration.value} ${p.concentration.unit}` : "concentration non renseignée"}{p.humanUse ? " · usage humain" : ""}</span>
                    </span>
                    <span className="shrink-0 text-theme-xs font-semibold tabular-nums">{establishment ? productStock(db, p.id, establishment.id, today) : 0} en stock</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {state && state.history.length > 0 && (
            <section className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 sm:p-5 dark:border-gray-800 dark:bg-white/3">
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Historique</h2>
              <ol className="mt-2 space-y-1.5 text-theme-xs text-gray-600 dark:text-gray-400">
                {state.history.map((h, i) => (
                  <li key={i}>
                    <span className="tabular-nums">{formatDateTime(h.date)}</span> · {db.users.find((u) => u.id === h.userId)?.name} · {h.action}
                    {h.note ? ` — ${h.note}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      {statusTo && (
        <AppModal
          isOpen
          onClose={() => setStatusTo(null)}
          size="sm"
          title={statusTo === "valide" ? "Valider la fiche" : statusTo === "retire" ? "Retirer la fiche" : "Envoyer en validation"}
          description={statusTo === "valide" ? "Vous confirmez avoir vérifié les posologies, contre-indications et alertes sur une référence à jour (RCP, Plumb's, BSAVA)." : m.name}
          footer={
            <>
              <Button size="sm" variant="outline" onClick={() => setStatusTo(null)}>Annuler</Button>
              <Button size="sm" variant={statusTo === "retire" ? "danger" : "primary"} disabled={statusTo === "retire" && !note.trim()} onClick={() => { if (run(setMoleculeStatus, { id: m.id, name: m.name, status: statusTo, note }).ok) { setStatusTo(null); setNote(""); } }}>Confirmer</Button>
            </>
          }
        >
          <TextAreaField label={statusTo === "retire" ? "Motif" : "Commentaire (facultatif)"} required={statusTo === "retire"} value={note} onChange={setNote} rows={2} />
        </AppModal>
      )}
      {isDraft && <MoleculeFormModal isOpen={edit} onClose={() => setEdit(false)} draftId={m.id} />}
    </div>
  );
}
