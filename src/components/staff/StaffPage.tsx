"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { addDays, formatDate, formatDateTime } from "@/lib/format";
import { cancelLeave, decideLeave, requestLeave, reviewObjective, saveObjective, type LeaveInput, type ObjectiveInput } from "@/lib/services/staffService";
import { absentOn, ANNUAL_LEAVE_DAYS, evalAverage, lastEvaluation, LEAVE_META, LEAVE_STATUS, leaveBalance, leaveDays, OBJ_STATE, objectiveProgress, objectiveState } from "@/lib/staff";
import type { LeaveKind, LeaveRequest, StaffObjective } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import StaffDirectory from "./StaffDirectory";
import StaffEvaluations from "./StaffEvaluations";

const Chip = ({ className, children }: { className: string; children: React.ReactNode }) => <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", className)}>{children}</span>;

function ObjectiveCard({ o, onEdit }: { o: StaffObjective; onEdit: () => void }) {
  const { db, run, user, today } = useDemo();
  const [rev, setRev] = useState<{ open: boolean; value: number; text: string }>({ open: false, value: o.current, text: "" });
  const st = objectiveState(o, today);
  const pct = objectiveProgress(o);
  const isDG = user?.roleId === "dg";
  const mine = o.userId === user?.id;
  return (
    <article className="cliva-rise rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">{userName(db, o.userId)} · {o.period} · échéance {formatDate(o.dueDate)}</p>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{o.title}</h3>
          <p className="text-theme-xs text-gray-600 dark:text-gray-400">{o.metric}</p>
        </div>
        <Chip className={OBJ_STATE[st].chip}>{OBJ_STATE[st].label}</Chip>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", OBJ_STATE[st].bar)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-semibold text-gray-800 tabular-nums dark:text-white/90">{o.current.toLocaleString("fr-FR")} / {o.target.toLocaleString("fr-FR")} {o.unit}</span>
      </div>
      {o.reviews[0] && <p className="mt-2 text-theme-xs text-gray-600 dark:text-gray-400">Dernier point ({formatDateTime(o.reviews[0].date)}, {userName(db, o.reviews[0].byId)}) : {o.reviews[0].text || "mise à jour du chiffre"}</p>}
      {(isDG || mine) && o.status === "en_cours" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button size="xs" variant="soft" onClick={() => setRev({ open: true, value: o.current, text: "" })}>Point d&apos;étape</Button>
          {isDG && <Button size="xs" variant="ghost" onClick={onEdit}>Modifier</Button>}
          {isDG && <Button size="xs" variant="ghost" onClick={() => run(reviewObjective, { id: o.id, text: "Objectif clos (non atteint).", status: "non_atteint" })}>Clore</Button>}
        </div>
      )}
      <AppModal isOpen={rev.open} onClose={() => setRev({ ...rev, open: false })} title="Point d'étape" description={o.title} footer={<><Button size="sm" variant="outline" onClick={() => setRev({ ...rev, open: false })}>Annuler</Button><Button size="sm" onClick={() => run(reviewObjective, { id: o.id, value: rev.value, text: rev.text }).ok && setRev({ ...rev, open: false })}>Enregistrer</Button></>}>
        <FormGrid>
          <NumberField label={`Réalisé (${o.unit})`} value={rev.value} onChange={(x) => setRev({ ...rev, value: x })} min={0} />
          <TextAreaField label="Commentaire" value={rev.text} onChange={(x) => setRev({ ...rev, text: x })} rows={2} className="sm:col-span-2" />
        </FormGrid>
      </AppModal>
    </article>
  );
}

export default function StaffPage() {
  const { db, run, user, today } = useDemo();
  const opts = useOptions();
  const [tab, setTab] = useState("equipe");
  const [leave, setLeave] = useState<LeaveInput | null>(null);
  const [decide, setDecide] = useState<{ l: LeaveRequest; approve: boolean; note: string } | null>(null);
  const [obj, setObj] = useState<ObjectiveInput | null>(null);
  const [filter, setFilter] = useState("");
  const isDG = user?.roleId === "dg";
  const year = today.slice(0, 4);
  const staff = db.users.filter((u) => u.active && u.roleId !== "confrere");
  const leaves = [...(db.leaves ?? [])].filter((l) => isDG || l.userId === user?.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const pending = leaves.filter((l) => l.status === "en_attente");
  const objectives = [...(db.objectives ?? [])].filter((o) => (isDG || o.userId === user?.id) && (!filter || o.userId === filter)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = (db.leaves ?? []).filter((l) => l.status === "approuvee" && l.end >= today && l.start <= addDays(today, 60)).sort((a, b) => a.start.localeCompare(b.start));
  const newLeave = (kind: LeaveKind = "conge") => setLeave({ userId: user?.id ?? "", kind, start: today, end: today, reason: "" });
  const newObj = (): ObjectiveInput => ({ userId: filter || (isDG ? "" : (user?.id ?? "")), title: "", metric: "", target: 10, unit: "", period: `T${Math.floor(Number(today.slice(5, 7)) / 3.01) + 1} ${year}`, dueDate: addDays(today, 60) });

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Gestion du personnel"
        subtitle="Congés, permissions, absences et objectifs individuels"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => newLeave("permission")}>Demander une permission</Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => newLeave("conge")}>Demander un congé</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Absents aujourd'hui", v: absentOn(db, today).length, h: absentOn(db, today).map((x) => userName(db, x.userId)).join(", ") || "Toute l'équipe est là" },
          { l: "Demandes en attente", v: pending.length, h: isDG ? "à valider par vous" : "vos demandes" },
          { l: "Absences à venir · 60 j", v: upcoming.length, h: "approuvées" },
          { l: "Objectifs en cours", v: objectives.filter((o) => o.status === "en_cours").length, h: `${objectives.filter((o) => ["en_retard", "a_risque"].includes(objectiveState(o, today))).length} en retard ou à risque` },
        ].map((k) => (
          <div key={k.l} className="cliva-rise rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">{k.l}</p>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">{k.v}</p>
            <p className="truncate text-theme-xs text-gray-500">{k.h}</p>
          </div>
        ))}
      </div>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "equipe", label: "Équipe et soldes" },
          { key: "demandes", label: "Congés et permissions", count: pending.length || undefined },
          { key: "absences", label: "Absences à venir", count: upcoming.length },
          { key: "objectifs", label: "Objectifs", count: objectives.length },
          { key: "notes", label: "Évaluations" },
          { key: "annuaire", label: "Annuaire et coordonnées" },
        ]}
      />

      {tab === "equipe" && (
        <DataTable
          rows={isDG ? staff : staff.filter((u) => u.id === user?.id)}
          rowKey={(u) => u.id}
          columns={[
            { key: "n", header: "Membre", primary: true, render: (u) => <span className="flex flex-col"><span className="font-medium text-gray-800 dark:text-white/90">{u.name}</span><span className="text-theme-xs text-gray-500">{u.title}</span></span> },
            { key: "c", header: `Congés ${year}`, render: (u) => { const b = leaveBalance(db, u.id, year); return <span className="tabular-nums">{b.taken} pris · <strong>{b.left}</strong> restant(s){b.pending ? ` · ${b.pending} en attente` : ""}</span>; } },
            { key: "p", header: "Permissions", align: "end", render: (u) => leaveBalance(db, u.id, year).permissions },
            { key: "m", header: "Maladie (j)", align: "end", render: (u) => leaveBalance(db, u.id, year).sick },
            { key: "o", header: "Objectifs", render: (u) => { const os = (db.objectives ?? []).filter((o) => o.userId === u.id && o.status === "en_cours"); return os.length ? `${os.length} en cours · ${Math.round(os.reduce((s, o) => s + objectiveProgress(o), 0) / os.length)} % moyen` : "—"; } },
            { key: "note", header: "Note", align: "end", render: (u) => { const e = lastEvaluation(db, u.id); return e ? <span className="font-semibold tabular-nums">{evalAverage(e).toFixed(1)}/5</span> : "—"; } },
            { key: "a", header: "Aujourd'hui", render: (u) => { const a = absentOn(db, today).find((x) => x.userId === u.id); return a ? <Chip className={LEAVE_META[a.kind].chip}>{LEAVE_META[a.kind].label}</Chip> : <span className="text-theme-xs text-success-600">Présent</span>; } },
          ]}
        />
      )}
      {tab === "equipe" && <p className="text-theme-xs text-gray-500">Référence : {ANNUAL_LEAVE_DAYS} jours ouvrables de congé par an (lundi au samedi). Les absences approuvées apparaissent dans l&apos;agenda.</p>}

      {tab === "demandes" && (
        <DataTable
          rows={leaves}
          rowKey={(l) => l.id}
          emptyTitle="Aucune demande"
          columns={[
            { key: "u", header: "Membre", primary: true, render: (l) => userName(db, l.userId) },
            { key: "k", header: "Type", render: (l) => <Chip className={LEAVE_META[l.kind].chip}>{LEAVE_META[l.kind].label}</Chip> },
            { key: "d", header: "Période", render: (l) => `${formatDate(l.start)}${l.end !== l.start ? ` → ${formatDate(l.end)}` : ""}${l.hours ? ` · ${l.hours.from}–${l.hours.to}` : ` · ${leaveDays(l)} j`}` },
            { key: "r", header: "Motif", render: (l) => <span className="line-clamp-2">{l.reason}</span> },
            { key: "s", header: "Statut", render: (l) => <span className="flex flex-col gap-0.5"><Chip className={LEAVE_STATUS[l.status].chip}>{LEAVE_STATUS[l.status].label}</Chip>{l.decisionNote && <span className="text-[11px] text-gray-500">{l.decisionNote}</span>}</span> },
            {
              key: "x",
              header: "",
              render: (l) => (
                <span className="flex flex-wrap gap-1">
                  {isDG && l.status === "en_attente" && <Button size="xs" onClick={() => setDecide({ l, approve: true, note: "" })}>Approuver</Button>}
                  {isDG && l.status === "en_attente" && <Button size="xs" variant="outline" onClick={() => setDecide({ l, approve: false, note: "" })}>Refuser</Button>}
                  {(l.status === "en_attente" || (l.status === "approuvee" && l.start > today)) && (isDG || l.userId === user?.id) && <Button size="xs" variant="ghost" onClick={() => run(cancelLeave, { id: l.id })}>Annuler</Button>}
                </span>
              ),
            },
          ]}
        />
      )}

      {tab === "absences" && (
        <ul className="space-y-2">
          {upcoming.map((l) => (
            <li key={l.id} className="cliva-rise flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/3">
              <span className={cn("size-2.5 rounded-full", LEAVE_META[l.kind].dot)} />
              <span className="font-medium text-gray-800 dark:text-white/90">{userName(db, l.userId)}</span>
              <Chip className={LEAVE_META[l.kind].chip}>{LEAVE_META[l.kind].label}</Chip>
              <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(l.start)}{l.end !== l.start ? ` → ${formatDate(l.end)}` : ""}{l.hours ? ` · ${l.hours.from}–${l.hours.to}` : ""}</span>
              {l.start <= today && <span className="ms-auto text-theme-xs font-medium text-warning-700 dark:text-warning-400">en cours</span>}
            </li>
          ))}
          {upcoming.length === 0 && <li className="rounded-2xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Aucune absence prévue dans les 60 prochains jours.</li>}
        </ul>
      )}

      {tab === "notes" && <StaffEvaluations />}
      {tab === "annuaire" && <StaffDirectory />}

      {tab === "objectifs" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {isDG && <div className="w-60"><SelectField label="" value={filter} onChange={setFilter} options={staff.map((u) => ({ value: u.id, label: u.name }))} allowEmpty placeholder="Toute l'équipe" /></div>}
            <Button size="sm" className="ms-auto" startIcon={<PlusIcon />} onClick={() => setObj(newObj())}>{isDG ? "Fixer un objectif" : "Proposer un objectif"}</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {objectives.map((o) => <ObjectiveCard key={o.id} o={o} onEdit={() => setObj({ ...o })} />)}
          </div>
          {objectives.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Aucun objectif.</p>}
        </div>
      )}

      <AppModal
        isOpen={!!leave}
        onClose={() => setLeave(null)}
        title="Demande d'absence"
        footer={<><Button size="sm" variant="outline" onClick={() => setLeave(null)}>Annuler</Button><Button size="sm" onClick={() => leave && run(requestLeave, leave).ok && setLeave(null)}>Envoyer</Button></>}
      >
        {leave && (
          <FormGrid>
            {isDG && <SelectField label="Membre" value={leave.userId} onChange={(x) => setLeave({ ...leave, userId: x })} options={staff.map((u) => ({ value: u.id, label: u.name }))} />}
            <SelectField label="Type" value={leave.kind} onChange={(x) => setLeave({ ...leave, kind: x as LeaveKind, hours: x === "permission" ? leave.hours : undefined })} options={(Object.keys(LEAVE_META) as LeaveKind[]).map((k) => ({ value: k, label: LEAVE_META[k].label }))} />
            <TextField label="Du" type="date" value={leave.start} onChange={(x) => setLeave({ ...leave, start: x, end: leave.end < x ? x : leave.end })} />
            <TextField label="Au" type="date" value={leave.end} onChange={(x) => setLeave({ ...leave, end: x })} />
            {leave.kind === "permission" && (
              <>
                <TextField label="De (heure, facultatif)" type="time" value={leave.hours?.from ?? ""} onChange={(x) => setLeave({ ...leave, hours: x ? { from: x, to: leave.hours?.to ?? "12:00" } : undefined })} />
                <TextField label="À" type="time" value={leave.hours?.to ?? ""} onChange={(x) => setLeave({ ...leave, hours: leave.hours ? { ...leave.hours, to: x } : undefined })} />
              </>
            )}
            <TextAreaField label="Motif" value={leave.reason} onChange={(x) => setLeave({ ...leave, reason: x })} rows={2} className="sm:col-span-2" />
            {leave.kind === "conge" && (
              <p className="text-theme-xs text-gray-500 sm:col-span-2">
                {leaveDays({ ...leave, id: "", status: "en_attente", requestedAt: "" })} jour(s) ouvrable(s) · solde : {leaveBalance(db, leave.userId, leave.start.slice(0, 4)).left} jour(s)
              </p>
            )}
          </FormGrid>
        )}
      </AppModal>

      <AppModal
        isOpen={!!decide}
        onClose={() => setDecide(null)}
        title={decide?.approve ? "Approuver la demande" : "Refuser la demande"}
        description={decide ? `${userName(db, decide.l.userId)} — ${LEAVE_META[decide.l.kind].label} du ${formatDate(decide.l.start)} au ${formatDate(decide.l.end)}` : ""}
        footer={<><Button size="sm" variant="outline" onClick={() => setDecide(null)}>Annuler</Button><Button size="sm" variant={decide?.approve ? "primary" : "danger"} onClick={() => decide && run(decideLeave, { id: decide.l.id, approve: decide.approve, note: decide.note }).ok && setDecide(null)}>{decide?.approve ? "Approuver" : "Refuser"}</Button></>}
      >
        {decide && <TextAreaField label={decide.approve ? "Commentaire (facultatif)" : "Motif du refus"} value={decide.note} onChange={(x) => setDecide({ ...decide, note: x })} rows={2} />}
      </AppModal>

      <AppModal
        isOpen={!!obj}
        onClose={() => setObj(null)}
        size="lg"
        title={obj?.id ? "Modifier l'objectif" : "Nouvel objectif"}
        footer={<><Button size="sm" variant="outline" onClick={() => setObj(null)}>Annuler</Button><Button size="sm" onClick={() => obj && run(saveObjective, obj).ok && setObj(null)}>Enregistrer</Button></>}
      >
        {obj && (
          <FormGrid>
            <SelectField label="Membre" required value={obj.userId} onChange={(x) => setObj({ ...obj, userId: x })} options={isDG ? opts.users : staff.filter((u) => u.id === user?.id).map((u) => ({ value: u.id, label: u.name }))} />
            <TextField label="Période" value={obj.period} onChange={(x) => setObj({ ...obj, period: x })} placeholder="T4 2026" />
            <TextField label="Objectif" required value={obj.title} onChange={(x) => setObj({ ...obj, title: x })} placeholder="Ex. : relancer les clients J+7 sans retard" className="sm:col-span-2" />
            <TextField label="Indicateur mesuré" value={obj.metric} onChange={(x) => setObj({ ...obj, metric: x })} placeholder="Ex. : relances effectuées dans les délais" className="sm:col-span-2" />
            <NumberField label="Cible" value={obj.target} onChange={(x) => setObj({ ...obj, target: x })} min={1} />
            <TextField label="Unité" value={obj.unit} onChange={(x) => setObj({ ...obj, unit: x })} placeholder="relances, ventes, FCFA, %" />
            <TextField label="Échéance" type="date" value={obj.dueDate} onChange={(x) => setObj({ ...obj, dueDate: x })} />
          </FormGrid>
        )}
      </AppModal>
    </div>
  );
}
