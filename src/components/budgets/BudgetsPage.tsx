"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { BUDGET_STATUS, budgetTotal, budgetUsage, lineUsage, STOCK_CATEGORY } from "@/lib/budgets";
import { userName } from "@/lib/calc";
import { formatDateTime, formatXOF, uid } from "@/lib/format";
import { decideBudget, saveBudget, submitBudget, type BudgetInput } from "@/lib/services/budgetsService";
import type { Budget } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const inp = "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm dark:border-gray-700 dark:text-white/90";
const monthLabel = (p: string) => new Date(`${p}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
      <div className={cn("h-full rounded-full transition-[width] duration-700", pct > 100 ? "bg-error-500" : pct > 85 ? "bg-warning-500" : "bg-linear-to-r from-brand-600 to-brand-400")} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function BudgetCard({ b, onEdit, onDecide }: { b: Budget; onEdit: () => void; onDecide: () => void }) {
  const { db, run, user } = useDemo();
  const u = budgetUsage(db, b);
  const isDG = user?.roleId === "dg";
  return (
    <article className="cliva-rise rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">{b.code} · {monthLabel(b.period)} · préparé par {userName(db, b.preparedById)}</p>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{b.title}</h3>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", BUDGET_STATUS[b.status].chip)}>{BUDGET_STATUS[b.status].label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-1">
        <p className="text-2xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white">{formatXOF(u.total)}</p>
        {b.status === "valide" && <p className="text-theme-xs text-gray-600 dark:text-gray-400">engagé {formatXOF(u.used)} · reste <strong className={u.left < 0 ? "text-error-600" : ""}>{formatXOF(u.left)}</strong></p>}
      </div>
      {b.status === "valide" && <div className="mt-2"><Bar pct={u.pct} /></div>}
      <ul className="mt-4 space-y-2.5">
        {b.lines.map((l) => {
          const x = lineUsage(db, l);
          const pct = l.amount ? Math.round((x.used / l.amount) * 100) : 0;
          return (
            <li key={l.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-gray-800 dark:text-white/90">{l.label} <span className="text-theme-xs text-gray-500">· {l.category}</span></span>
                <span className="shrink-0 tabular-nums text-gray-900 dark:text-white/90">{b.status === "valide" ? `${formatXOF(x.used)} / ` : ""}{formatXOF(l.amount)}</span>
              </div>
              {b.status === "valide" && <div className="mt-1"><Bar pct={pct} /></div>}
              {l.note && <p className="text-[11px] text-gray-500">{l.note}</p>}
            </li>
          );
        })}
      </ul>
      {b.justification && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-theme-xs text-gray-700 dark:bg-white/5 dark:text-gray-300"><strong>Justification :</strong> {b.justification}</p>}
      {b.decisionNote && <p className="mt-2 text-theme-xs text-gray-600 dark:text-gray-400"><strong>Décision du DG :</strong> {b.decisionNote}</p>}
      <details className="mt-2 text-theme-xs text-gray-500">
        <summary className="cursor-pointer">Historique</summary>
        <ul className="mt-1 space-y-0.5">{b.history.map((h, i) => <li key={i}>{formatDateTime(h.date)} · {userName(db, h.userId)} — {h.text}</li>)}</ul>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        {(b.status !== "valide" || isDG) && (b.preparedById === user?.id || isDG) && <Button size="xs" variant="outline" onClick={onEdit}>Modifier</Button>}
        {["brouillon", "refuse"].includes(b.status) && b.preparedById === user?.id && !isDG && <Button size="xs" onClick={() => run(submitBudget, { id: b.id })}>Présenter au DG</Button>}
        {isDG && b.status === "soumis" && <Button size="xs" onClick={onDecide}>Examiner et valider</Button>}
      </div>
    </article>
  );
}

/** Budgets mensuels : préparés par l'équipe, validés par le DG, suivis par ligne. */
export default function BudgetsPage() {
  const { db, run, user, today } = useDemo();
  const isDG = user?.roleId === "dg";
  const [tab, setTab] = useState("encours");
  const [edit, setEdit] = useState<BudgetInput | null>(null);
  const [dec, setDec] = useState<{ b: Budget; note: string; amounts: Record<string, number> } | null>(null);
  const all = [...(db.budgets ?? [])].sort((a, b) => b.period.localeCompare(a.period));
  const list = all.filter((b) => (tab === "encours" ? b.status === "valide" && b.period >= today.slice(0, 7) : tab === "attente" ? ["brouillon", "soumis", "refuse"].includes(b.status) : b.status === "valide" && b.period < today.slice(0, 7)));
  const cats = [STOCK_CATEGORY, ...db.settings.expenseCategories];
  const blank = (): BudgetInput => ({ title: `Budget de fonctionnement — ${monthLabel(today.slice(0, 7))}`, period: today.slice(0, 7), justification: "", lines: [{ id: uid("bl"), category: STOCK_CATEGORY, label: "Médicaments et vaccins", amount: 0 }] });
  const setLine = (i: number, patch: Partial<BudgetInput["lines"][number]>) => edit && setEdit({ ...edit, lines: edit.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Budgets"
        subtitle={isDG ? "Les budgets présentés par l'équipe : validez-les, ajustez-les, suivez ce qui est engagé" : "Préparez un budget et présentez-le au DG : vos commandes et dépenses s'y imputent"}
        actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit(blank())}>Préparer un budget</Button>}
      />
      <div className="rounded-3xl border border-tertiary-200 bg-tertiary-25 p-4 text-theme-xs text-tertiary-800 dark:border-tertiary-500/20 dark:bg-tertiary-500/5 dark:text-tertiary-200">
        Règle : une commande fournisseur ou une dépense qui dépasse la ligne de budget validée (ou qui n&apos;est imputée sur aucun budget) doit recevoir l&apos;aval du DG avant d&apos;être engagée.
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: "encours", label: "Budgets en cours", count: all.filter((b) => b.status === "valide" && b.period >= today.slice(0, 7)).length }, { key: "attente", label: "À valider / brouillons", count: all.filter((b) => ["brouillon", "soumis", "refuse"].includes(b.status)).length }, { key: "passes", label: "Mois passés" }]} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {list.map((b) => <BudgetCard key={b.id} b={b} onEdit={() => setEdit({ id: b.id, title: b.title, period: b.period, justification: b.justification, lines: b.lines.map((l) => ({ ...l })) })} onDecide={() => setDec({ b, note: "", amounts: Object.fromEntries(b.lines.map((l) => [l.id, l.amount])) })} />)}
      </div>
      {list.length === 0 && <p className="rounded-3xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucun budget dans cette liste.</p>}

      <AppModal
        isOpen={!!edit}
        onClose={() => setEdit(null)}
        size="lg"
        title={edit?.id ? "Modifier le budget" : "Préparer un budget"}
        description="Une ligne par poste : achats de stock, carburant, entretien… Le DG peut ajuster les montants en validant."
        footer={<><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Annuler</Button><Button size="sm" onClick={() => edit && run(saveBudget, edit).ok && setEdit(null)}>Enregistrer</Button></>}
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_11rem]">
              <TextField label="Intitulé" value={edit.title} onChange={(x) => setEdit({ ...edit, title: x })} />
              <TextField label="Mois" type="month" value={edit.period} onChange={(x) => setEdit({ ...edit, period: x })} />
            </div>
            <div className="space-y-2">
              {edit.lines.map((l, i) => (
                <div key={l.id} className="grid grid-cols-1 gap-2 rounded-2xl border border-gray-100 p-2 sm:grid-cols-[11rem_1fr_9rem_auto] dark:border-gray-800">
                  <select aria-label="Catégorie" value={l.category} onChange={(e) => setLine(i, { category: e.target.value })} className={inp}>
                    {cats.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <input aria-label="Libellé" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="Ex. : vaccins volaille campagne" className={inp} />
                  <input aria-label="Montant" type="number" min={0} step={5000} value={l.amount || ""} onChange={(e) => setLine(i, { amount: Number(e.target.value) })} placeholder="FCFA" className={cn(inp, "tabular-nums")} />
                  <Button size="xs" variant="ghost" onClick={() => setEdit({ ...edit, lines: edit.lines.filter((_, k) => k !== i) })}>✕</Button>
                  <input aria-label="Précision" value={l.note ?? ""} onChange={(e) => setLine(i, { note: e.target.value })} placeholder="Précision (facultatif)" className={cn(inp, "sm:col-span-4")} />
                </div>
              ))}
              <Button size="xs" variant="soft" onClick={() => setEdit({ ...edit, lines: [...edit.lines, { id: uid("bl"), category: db.settings.expenseCategories[0] ?? STOCK_CATEGORY, label: "", amount: 0 }] })}>+ Ajouter une ligne</Button>
              <p className="text-end text-sm font-semibold tabular-nums text-gray-900 dark:text-white">Total : {formatXOF(edit.lines.reduce((s, l) => s + (l.amount || 0), 0))}</p>
            </div>
            <TextAreaField label="Justification (pour le DG)" value={edit.justification} onChange={(x) => setEdit({ ...edit, justification: x })} rows={3} />
          </div>
        )}
      </AppModal>

      <AppModal
        isOpen={!!dec}
        onClose={() => setDec(null)}
        size="lg"
        title="Valider le budget"
        description={dec ? `${dec.b.title} — présenté par ${userName(db, dec.b.preparedById)} (${formatXOF(budgetTotal(dec.b))})` : ""}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => dec && run(decideBudget, { id: dec.b.id, approve: false, note: dec.note }).ok && setDec(null)}>Refuser (motif requis)</Button>
            <Button size="sm" onClick={() => dec && run(decideBudget, { id: dec.b.id, approve: true, note: dec.note, amounts: dec.amounts }).ok && setDec(null)}>Valider</Button>
          </>
        }
      >
        {dec && (
          <div className="space-y-3">
            <p className="text-theme-xs text-gray-500">Vous pouvez ajuster chaque montant avant de valider.</p>
            {dec.b.lines.map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_10rem] items-center gap-2">
                <span className="text-sm text-gray-800 dark:text-white/90">{l.label} <span className="text-theme-xs text-gray-500">· {l.category}</span></span>
                <input aria-label={`Montant ${l.label}`} type="number" min={0} step={5000} value={dec.amounts[l.id]} onChange={(e) => setDec({ ...dec, amounts: { ...dec.amounts, [l.id]: Number(e.target.value) } })} className={cn(inp, "tabular-nums")} />
              </div>
            ))}
            <p className="text-end text-sm font-semibold tabular-nums">Total validé : {formatXOF(Object.values(dec.amounts).reduce((s, x) => s + (x || 0), 0))}</p>
            {dec.b.justification && <p className="rounded-xl bg-gray-50 p-3 text-theme-xs dark:bg-white/5">{dec.b.justification}</p>}
            <TextAreaField label="Commentaire au demandeur" value={dec.note} onChange={(x) => setDec({ ...dec, note: x })} rows={2} />
          </div>
        )}
      </AppModal>
    </div>
  );
}
