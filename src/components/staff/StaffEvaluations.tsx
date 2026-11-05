"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { saveEvaluation, type EvaluationInput } from "@/lib/services/staffService";
import { EVAL_CRITERIA, evalAverage } from "@/lib/staff";
import { cn } from "@/utils";
import { useState } from "react";

function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex gap-0.5" role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} sur 5`} aria-checked={onChange ? value === n : undefined} role={onChange ? "radio" : undefined} className={cn("leading-none transition-transform", size === "sm" ? "text-sm" : "text-xl", onChange && "cliva-press hover:scale-110", n <= value ? "text-warning-400" : "text-gray-300 dark:text-gray-600")}>
          ★
        </button>
      ))}
    </span>
  );
}

export const scoreTone = (v: number) => (v >= 4 ? "text-success-600 dark:text-success-400" : v >= 3 ? "text-warning-600 dark:text-warning-400" : "text-error-600 dark:text-error-400");

/** Notation du personnel par critères (1 à 5), points forts et axes de progrès. */
export default function StaffEvaluations() {
  const { db, run, user, today } = useDemo();
  const isDG = user?.roleId === "dg";
  const [v, setV] = useState<EvaluationInput | null>(null);
  const staff = db.users.filter((u) => u.active && u.roleId !== "confrere" && u.id !== user?.id);
  const list = [...(db.evaluations ?? [])].filter((e) => isDG || e.userId === user?.id).sort((a, b) => b.date.localeCompare(a.date));
  const month = new Date(`${today}T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const blank = (userId = ""): EvaluationInput => ({ userId, period: month.charAt(0).toUpperCase() + month.slice(1), scores: Object.fromEntries(EVAL_CRITERIA.map((c) => [c.key, 0])), strengths: "", improvements: "", comment: "" });
  const people = isDG ? staff : db.users.filter((u) => u.id === user?.id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((u) => {
          const mine = list.filter((e) => e.userId === u.id);
          const last = mine[0];
          const avg = last ? evalAverage(last) : 0;
          const prev = mine[1] ? evalAverage(mine[1]) : undefined;
          return (
            <article key={u.id} className="cliva-rise rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">{u.name}</p>
                  <p className="truncate text-theme-xs text-gray-500">{u.title}</p>
                </div>
                <div className="text-end">
                  <p className={cn("text-2xl font-semibold tabular-nums", last ? scoreTone(avg) : "text-gray-300")}>{last ? avg.toFixed(1) : "—"}<span className="text-sm text-gray-400">/5</span></p>
                  {prev !== undefined && <p className="text-[11px] text-gray-500">{avg >= prev ? "▲" : "▼"} {prev.toFixed(1)} avant</p>}
                </div>
              </div>
              {last ? (
                <>
                  <p className="mt-1 text-theme-xs text-gray-500">{last.period} · par {userName(db, last.byId)}</p>
                  <ul className="mt-2 space-y-1">
                    {EVAL_CRITERIA.map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-2 text-theme-xs text-gray-700 dark:text-gray-300">
                        <span className="truncate">{c.label}</span>
                        <Stars value={last.scores[c.key] ?? 0} size="sm" />
                      </li>
                    ))}
                  </ul>
                  {last.strengths && <p className="mt-2 text-theme-xs"><span className="font-medium text-success-700 dark:text-success-400">Points forts :</span> {last.strengths}</p>}
                  {last.improvements && <p className="text-theme-xs"><span className="font-medium text-warning-700 dark:text-warning-400">À améliorer :</span> {last.improvements}</p>}
                </>
              ) : (
                <p className="mt-3 text-theme-xs text-gray-500">Pas encore évalué.</p>
              )}
              {isDG && <Button size="xs" variant="soft" className="mt-3" startIcon={<PlusIcon />} onClick={() => setV(blank(u.id))}>Noter</Button>}
            </article>
          );
        })}
      </div>
      {list.length > 0 && (
        <div className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Historique des évaluations</h3>
          <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-40 font-medium text-gray-800 dark:text-white/90">{userName(db, e.userId)}</span>
                <span className="text-theme-xs text-gray-500">{e.period} · {formatDate(e.date)}</span>
                <span className={cn("ms-auto font-semibold tabular-nums", scoreTone(evalAverage(e)))}>{evalAverage(e).toFixed(1)}/5</span>
                {isDG && <Button size="xs" variant="ghost" onClick={() => setV({ ...e })}>Modifier</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <AppModal
        isOpen={!!v}
        onClose={() => setV(null)}
        size="lg"
        title="Noter un membre du personnel"
        description="Chaque critère de 1 (insuffisant) à 5 (excellent). Le membre est prévenu et voit son évaluation."
        footer={<><Button size="sm" variant="outline" onClick={() => setV(null)}>Annuler</Button><Button size="sm" onClick={() => v && run(saveEvaluation, v).ok && setV(null)}>Enregistrer</Button></>}
      >
        {v && (
          <div className="space-y-4">
            <FormGrid>
              <SelectField label="Membre" value={v.userId} onChange={(x) => setV({ ...v, userId: x })} options={staff.map((u) => ({ value: u.id, label: u.name }))} />
              <TextField label="Période" value={v.period} onChange={(x) => setV({ ...v, period: x })} />
            </FormGrid>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
              {EVAL_CRITERIA.map((c) => (
                <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm text-gray-800 dark:text-white/90">{c.label}</span>
                  <Stars value={v.scores[c.key] ?? 0} onChange={(n) => setV({ ...v, scores: { ...v.scores, [c.key]: n } })} />
                </li>
              ))}
            </ul>
            <FormGrid>
              <TextAreaField label="Points forts" value={v.strengths} onChange={(x) => setV({ ...v, strengths: x })} rows={2} />
              <TextAreaField label="Axes de progrès" value={v.improvements} onChange={(x) => setV({ ...v, improvements: x })} rows={2} />
              <TextAreaField label="Commentaire" value={v.comment} onChange={(x) => setV({ ...v, comment: x })} rows={2} className="sm:col-span-2" />
            </FormGrid>
          </div>
        )}
      </AppModal>
    </div>
  );
}
