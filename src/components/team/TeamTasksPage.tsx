"use client";

import AppModal from "@/components/common/AppModal";
import AvatarInitials from "@/components/common/AvatarInitials";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { addDays, formatDate } from "@/lib/format";
import { assignTeamTask, completeTeamTask, reviewTeamTask, type TeamTaskInput } from "@/lib/services/teamTasksService";
import type { Task } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const PRIO: Record<Task["priority"], string> = { basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" };
const inp = "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";

function TaskCard({ t, mine }: { t: Task; mine: boolean }) {
  const { db, run, user, today } = useDemo();
  const [doing, setDoing] = useState(false);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [fix, setFix] = useState("");
  const late = t.status !== "termine" && t.dueDate < today;
  const reviewer = t.review?.status === "a_verifier" && (t.assignedById === user?.id || user?.roleId === "dg");
  return (
    <li className={cn("rounded-2xl border bg-white p-4 shadow-cliva dark:bg-white/3", late ? "border-error-200 dark:border-error-500/30" : t.review?.status === "a_reprendre" ? "border-warning-300 dark:border-warning-500/30" : "border-gray-200/70 dark:border-gray-800")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            {t.category === "document" && <span className="rounded-full bg-blue-light-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-300">Document</span>}
            {(t.priority === "haute" || t.priority === "urgente") && <span className="rounded-full bg-error-50 px-1.5 py-0.5 text-[11px] font-medium text-error-700 dark:bg-error-500/15 dark:text-error-300">{PRIO[t.priority]}</span>}
            {t.review?.status === "a_verifier" && <span className="rounded-full bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">À vérifier</span>}
            {t.review?.status === "valide" && <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700 dark:bg-success-500/15 dark:text-success-300">Validée</span>}
            {t.review?.status === "a_reprendre" && <span className="rounded-full bg-warning-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">À reprendre</span>}
          </p>
          <p className="mt-0.5 font-semibold text-gray-800 dark:text-white/90">{t.title}</p>
          {t.description && <p className="text-theme-sm text-gray-600 dark:text-gray-400">{t.description}</p>}
          <p className={cn("text-theme-xs", late ? "font-medium text-error-600" : "text-gray-500")}>Pour le {formatDate(t.dueDate)}{late && " · en retard"} · {mine ? `confiée par ${userName(db, t.assignedById)}` : userName(db, t.assigneeId)}</p>
          {t.review?.status === "a_reprendre" && t.review.note && <p className="mt-1 rounded-lg bg-warning-50 px-2 py-1 text-theme-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">À reprendre : {t.review.note}</p>}
          {t.status === "termine" && (
            <p className="mt-1 text-theme-sm text-gray-700 dark:text-gray-300">
              ✓ {t.result}
              {t.driveUrl && <> · <a href={t.driveUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Ouvrir le document ↗</a></>}
            </p>
          )}
        </div>
        {mine && t.status !== "termine" && !doing && <Button size="sm" onClick={() => setDoing(true)}>C&apos;est fait</Button>}
      </div>
      {doing && (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (run(completeTeamTask, { id: t.id, note, driveUrl: url }).ok) setDoing(false); }}>
          {t.category === "document" && <input className={inp} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Lien Drive du document (obligatoire)" aria-label="Lien Drive" />}
          {t.category !== "document" && <input className={inp} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Lien Drive (facultatif)" aria-label="Lien Drive" />}
          <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Un mot sur ce qui a été fait (facultatif)" aria-label="Note" />
          <div className="flex gap-2"><Button size="sm" type="submit" disabled={t.category === "document" && !url.trim()}>Valider</Button><Button size="sm" variant="ghost" onClick={() => setDoing(false)}>Annuler</Button></div>
        </form>
      )}
      {reviewer && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Button size="sm" onClick={() => run(reviewTeamTask, { id: t.id, ok: true })}>Valider</Button>
          <input className={cn(inp, "h-9 min-w-0 flex-1")} value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Ce qu'il faut reprendre" aria-label="À reprendre" />
          <Button size="sm" variant="outline" disabled={!fix.trim()} onClick={() => run(reviewTeamTask, { id: t.id, ok: false, note: fix }).ok && setFix("")}>À reprendre</Button>
        </div>
      )}
    </li>
  );
}

export default function TeamTasksPage() {
  const { db, run, user, today } = useDemo();
  const [tab, setTab] = useState<"miennes" | "equipe" | "verifier">("miennes");
  const [form, setForm] = useState<TeamTaskInput | null>(null);
  const [who, setWho] = useState("");
  const team = db.users.filter((u) => u.active && u.roleId !== "confrere");
  const teamTasks = db.tasks.filter((t) => t.category === "equipe" || t.category === "document" || !!t.assignedById);
  const mine = teamTasks.filter((t) => t.assigneeId === user?.id && (t.status !== "termine" || t.review?.status === "a_verifier")).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const toCheck = teamTasks.filter((t) => t.review?.status === "a_verifier" && (t.assignedById === user?.id || user?.roleId === "dg"));
  const shown = teamTasks.filter((t) => (!who || t.assigneeId === who) && (t.status !== "termine" || (t.review?.at ?? "") >= addDays(today, -30) || t.review?.status === "a_verifier")).sort((a, b) => Number(a.status === "termine") - Number(b.status === "termine") || a.dueDate.localeCompare(b.dueDate));
  const blank = (): TeamTaskInput => ({ title: "", description: "", assigneeId: "", priority: "normale", dueDate: addDays(today, 3), category: "equipe" });
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Tâches de l'équipe" subtitle="Confier, suivre et vérifier le travail de chacun" trail={[{ label: "Équipe", href: "/equipe" }]} actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setForm(blank())}>Confier une tâche</Button>} />
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
        {([["miennes", `Mes tâches (${mine.length})`], ["equipe", "Suivi de l'équipe"], ["verifier", `À vérifier (${toCheck.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>{l}</button>
        ))}
      </div>
      {tab === "equipe" && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {team.map((u) => {
            const list = teamTasks.filter((t) => t.assigneeId === u.id);
            const open = list.filter((t) => t.status !== "termine").length;
            const late = list.filter((t) => t.status !== "termine" && t.dueDate < today).length;
            return (
              <li key={u.id}>
                <button type="button" aria-pressed={who === u.id} onClick={() => setWho(who === u.id ? "" : u.id)} className={cn("flex w-full items-center gap-2 rounded-2xl border p-2.5 text-start", who === u.id ? "border-brand-500 bg-brand-25 dark:bg-brand-500/10" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3")}>
                  <AvatarInitials name={u.name} size="sm" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{u.name}</span><span className={cn("block text-theme-xs", late ? "text-error-600" : "text-gray-500")}>{open} en cours{late ? ` · ${late} en retard` : ""}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(tab === "miennes" ? mine : tab === "verifier" ? toCheck : shown).map((t) => <TaskCard key={t.id} t={t} mine={t.assigneeId === user?.id} />)}
      </ul>
      {(tab === "miennes" ? mine : tab === "verifier" ? toCheck : shown).length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">{tab === "miennes" ? "Rien à faire pour le moment." : tab === "verifier" ? "Rien à vérifier." : "Aucune tâche."}</p>}
      {form && (
        <AppModal isOpen onClose={() => setForm(null)} title="Confier une tâche" footer={<><Button size="sm" variant="outline" onClick={() => setForm(null)}>Annuler</Button><Button size="sm" onClick={() => run(assignTeamTask, form).ok && setForm(null)} disabled={!form.title.trim() || !form.assigneeId}>Confier</Button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {(["equipe", "document"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={form.category === k} onClick={() => setForm({ ...form, category: k })} className={cn("rounded-2xl border px-3 py-2.5 text-start", form.category === k ? "border-brand-500 bg-brand-25 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-700")}>
                  <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{k === "equipe" ? "Une tâche" : "Un document à produire"}</span>
                  <span className="block text-theme-xs text-gray-500">{k === "equipe" ? "Appel, rangement, commande…" : "La personne joindra le lien Drive"}</span>
                </button>
              ))}
            </div>
            <FormGrid>
              <TextField label="Quoi ?" required value={form.title} onChange={(x) => setForm({ ...form, title: x })} placeholder={form.category === "document" ? "Ex. : rapport de visite ferme Koné" : "Ex. : inventaire du rayon vaccins"} className="sm:col-span-2" />
              <SelectField label="Qui ?" required value={form.assigneeId} onChange={(x) => setForm({ ...form, assigneeId: x })} options={team.map((u) => ({ value: u.id, label: u.name }))} />
              <TextField label="Pour quand ?" type="date" value={form.dueDate} onChange={(x) => setForm({ ...form, dueDate: x })} />
              <SelectField label="Priorité" value={form.priority} onChange={(x) => setForm({ ...form, priority: x as Task["priority"] })} options={Object.entries(PRIO).map(([value, label]) => ({ value, label }))} />
              <TextAreaField label="Précisions" value={form.description} onChange={(x) => setForm({ ...form, description: x })} rows={2} className="sm:col-span-2" />
            </FormGrid>
          </div>
        </AppModal>
      )}
    </div>
  );
}
