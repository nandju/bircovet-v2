"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { PlusIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { addDays, formatDate, formatDateTime, isoDay } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { setTaskStatus } from "@/lib/services/tasksService";
import type { Task } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";
import { CompleteModal, PostponeModal, TaskModal } from "./CrmModals";

export default function TasksPage() {
  const { db, run, today, can } = useDemo();
  const opts = useOptions();
  const create = useModal();
  const nouveau = useQueryParam("nouveau");
  const openCreate = create.openModal;
  useEffect(() => {
    if (nouveau) openCreate();
  }, [nouveau, openCreate]);
  const [view, setView] = useState("liste");
  const [f, setF] = useState<Record<string, string>>({ status: "" });
  const [edit, setEdit] = useState<Task | undefined>();
  const [postpone, setPostpone] = useState<Task | null>(null);
  const [complete, setComplete] = useState<Task | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const editModal = useModal();
  const rows = useMemo(
    () =>
      db.tasks.filter(
        (t) =>
          (!f.status || (f.status === "retard" ? t.status !== "termine" && t.dueDate < today : t.status === f.status)) &&
          (!f.priority || t.priority === f.priority) &&
          (!f.category || t.category === f.category) &&
          (!f.assignee || t.assigneeId === f.assignee),
      ),
    [db, f, today],
  );
  const overdue = db.tasks.filter((t) => t.status !== "termine" && t.dueDate < today).length;
  const editable = can("relation", "update");
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 3));

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Tâches et suivis"
        subtitle={`${overdue} tâche(s) en retard`}
        trail={[{ label: "Relation client", href: "/relation-client" }]}
        actions={
          <Can module="relation" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>Nouvelle tâche</Button>
          </Can>
        }
      />
      <Panel>
        <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs tabs={[{ key: "liste", label: "Liste" }, { key: "calendrier", label: "Calendrier" }]} active={view} onChange={setView} />
          <Button size="xs" variant={f.status === "retard" ? "danger" : "outline"} onClick={() => setF({ ...f, status: f.status === "retard" ? "" : "retard" })}>Tâches en retard ({overdue})</Button>
        </div>
        <FilterBar
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "status", label: "Tous statuts", options: optionsOf("task") },
            { key: "priority", label: "Toutes priorités", options: optionsOf("priority") },
            { key: "category", label: "Toutes catégories", options: optionsOf("taskCategory") },
            { key: "assignee", label: "Tous responsables", options: opts.users },
          ]}
        />
        {view === "liste" ? (
          <DataTable
            rows={rows}
            rowKey={(t) => t.id}
            initialSort={{ key: "d", dir: "asc" }}
            rowClassName={(t) => (t.status !== "termine" && t.dueDate < today ? "bg-error-25/60 dark:bg-error-500/5" : "")}
            columns={[
              { key: "t", header: "Tâche", primary: true, render: (t) => <span className="flex flex-col"><span className="font-medium">{t.title}</span><span className="text-theme-xs text-gray-500">{[t.clientId && clientName(db, t.clientId), t.patientId && patientName(db, t.patientId)].filter(Boolean).join(" · ")}</span></span> },
              { key: "c", header: "Catégorie", hideOnMobile: true, render: (t) => <StatusBadge kind="taskCategory" value={t.category} /> },
              { key: "p", header: "Priorité", sortValue: (t) => ["basse", "normale", "haute", "urgente"].indexOf(t.priority), render: (t) => <StatusBadge kind="priority" value={t.priority} /> },
              { key: "d", header: "Échéance", sortValue: (t) => t.dueDate, render: (t) => <span className={cn(t.status !== "termine" && t.dueDate < today && "font-medium text-error-600")}>{formatDate(t.dueDate)}</span> },
              { key: "a", header: "Responsable", render: (t) => userName(db, t.assigneeId) },
              { key: "s", header: "Statut", render: (t) => <StatusBadge kind="task" value={t.status} /> },
              {
                key: "x",
                header: "Actions",
                render: (t) => (
                  <span className="flex flex-wrap gap-1">
                    {editable && t.status === "a_faire" && <Button size="xs" variant="soft" onClick={() => run(setTaskStatus, { id: t.id, status: "en_cours" })}>Démarrer</Button>}
                    {editable && t.status === "en_cours" && <Button size="xs" variant="ghost" onClick={() => run(setTaskStatus, { id: t.id, status: "en_attente" })}>En attente</Button>}
                    {editable && t.status === "en_attente" && <Button size="xs" variant="ghost" onClick={() => run(setTaskStatus, { id: t.id, status: "en_cours" })}>Reprendre</Button>}
                    {editable && t.status !== "termine" && <Button size="xs" onClick={() => setComplete(t)}>Terminer</Button>}
                    {editable && <Button size="xs" variant="outline" onClick={() => setPostpone(t)}>Reporter</Button>}
                    {editable && <Button size="xs" variant="ghost" onClick={() => { setEdit(t); editModal.openModal(); }}>Modifier</Button>}
                    <Button size="xs" variant="ghost" onClick={() => setHistoryOf(historyOf === t.id ? null : t.id)}>Historique</Button>
                    {historyOf === t.id && (
                      <span className="mt-1 block w-full text-[11px] text-gray-500">
                        {t.history.map((h, i) => (
                          <span key={i} className="block">{formatDateTime(h.date)} — {h.action}{h.note && ` (${h.note})`} · {userName(db, h.userId)}</span>
                        ))}
                        {t.result && <span className="block font-medium">Résultat : {t.result}</span>}
                      </span>
                    )}
                  </span>
                ),
              },
            ]}
            emptyTitle="Aucune tâche"
          />
        ) : (
          <div className="custom-scrollbar overflow-x-auto px-4">
            <div className="grid min-w-[900px] grid-cols-7 gap-2">
              {days.map((d) => {
                const list = rows.filter((t) => t.dueDate === d);
                return (
                  <div key={d} className={cn("min-h-28 rounded-xl border p-2", d === today ? "border-brand-300 bg-brand-25 dark:border-brand-700 dark:bg-brand-500/5" : "border-gray-200 dark:border-gray-800")}>
                    <p className="mb-1 text-theme-xs font-medium text-gray-500">{new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</p>
                    {list.map((t) => (
                      <p key={t.id} className={cn("mb-1 truncate rounded-md px-1.5 py-1 text-[11px]", t.status === "termine" ? "bg-gray-100 text-gray-400 line-through dark:bg-white/5" : d < isoDay() ? "bg-error-50 text-error-700 dark:bg-error-500/15" : "bg-tertiary-50 text-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-300")} title={t.title}>
                        {t.title}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
      <TaskModal isOpen={create.isOpen} onClose={create.closeModal} />
      <TaskModal isOpen={editModal.isOpen} onClose={editModal.closeModal} task={edit} />
      <PostponeModal task={postpone} onClose={() => setPostpone(null)} />
      <CompleteModal task={complete} onClose={() => setComplete(null)} />
    </div>
  );
}
