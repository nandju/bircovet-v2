"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { addDays } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createTask, logSimulatedMessage, postponeTask, renderTemplate, setTaskStatus, updateTask, type TaskInput } from "@/lib/services/tasksService";
import type { Interaction, Task } from "@/lib/types";
import { useEffect, useState } from "react";

export function TaskModal({ isOpen, onClose, task, preset }: { isOpen: boolean; onClose: () => void; task?: Task; preset?: Partial<TaskInput> }) {
  const { run, today, user } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState<TaskInput>({ title: "", description: "", assigneeId: "", priority: "normale", dueDate: "", category: "administratif" });
  useEffect(() => {
    if (!isOpen) return;
    setV(task ? { title: task.title, description: task.description, assigneeId: task.assigneeId, priority: task.priority, dueDate: task.dueDate, category: task.category, clientId: task.clientId, patientId: task.patientId } : { title: "", description: "", assigneeId: user?.id ?? "", priority: "normale", dueDate: addDays(today, 2), category: "administratif", ...preset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task]);
  const set = <K extends keyof TaskInput>(k: K, x: TaskInput[K]) => setV((s) => ({ ...s, [k]: x }));
  const save = () => (task ? run(updateTask, { id: task.id, patch: { ...v, dueDate: task.dueDate } }) : run(createTask, v)).ok && onClose();
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? "Modifier la tâche" : "Nouvelle tâche"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.title.trim() || !v.assigneeId}>Enregistrer</Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Titre" required value={v.title} onChange={(x) => set("title", x)} className="sm:col-span-2" />
        <SelectField label="Responsable" required value={v.assigneeId} onChange={(x) => set("assigneeId", x)} options={opts.users} />
        <SelectField label="Catégorie" value={v.category} onChange={(x) => set("category", x as TaskInput["category"])} options={optionsOf("taskCategory")} />
        <SelectField label="Priorité" value={v.priority} onChange={(x) => set("priority", x as TaskInput["priority"])} options={optionsOf("priority")} />
        <TextField label="Échéance" type="date" value={v.dueDate} onChange={(x) => set("dueDate", x)} disabled={!!task} hint={task ? "Utilisez « Reporter » pour changer l'échéance." : undefined} />
        <SelectField label="Client associé" value={v.clientId ?? ""} onChange={(x) => setV({ ...v, clientId: x || undefined, patientId: undefined })} options={opts.clients} allowEmpty placeholder="Aucun" />
        <SelectField label="Patient associé" value={v.patientId ?? ""} onChange={(x) => set("patientId", x || undefined)} options={opts.patientsOf(v.clientId)} allowEmpty placeholder="Aucun" disabled={!v.clientId} />
        <TextAreaField label="Description" value={v.description} onChange={(x) => set("description", x)} rows={3} className="sm:col-span-2" />
      </FormGrid>
    </AppModal>
  );
}

export function PostponeModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { run } = useDemo();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (task) {
      setDate(addDays(task.dueDate, 2));
      setReason("");
    }
  }, [task]);
  if (!task) return null;
  return (
    <AppModal
      isOpen={!!task}
      onClose={onClose}
      size="sm"
      title="Reporter la tâche"
      description={task.title}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" disabled={!date || !reason.trim()} onClick={() => run(postponeTask, { id: task.id, newDueDate: date, reason }).ok && onClose()}>Reporter</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nouvelle échéance (obligatoire)" required type="date" value={date} onChange={setDate} />
        <TextAreaField label="Motif du report" required value={reason} onChange={setReason} rows={2} />
      </div>
    </AppModal>
  );
}

export function CompleteModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { run } = useDemo();
  const [result, setResult] = useState("");
  useEffect(() => setResult(""), [task]);
  if (!task) return null;
  return (
    <AppModal
      isOpen={!!task}
      onClose={onClose}
      size="sm"
      title="Terminer la tâche"
      description={task.title}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" disabled={!result.trim()} onClick={() => run(setTaskStatus, { id: task.id, status: "termine", result }).ok && onClose()}>Terminer</Button>
        </>
      }
    >
      <TextAreaField label="Résultat" required value={result} onChange={setResult} rows={3} />
    </AppModal>
  );
}

/** Préparation d'un message à partir d'un modèle — aperçu, puis enregistrement SIMULÉ (aucun envoi). */
export function MessageModal({ target, onClose }: { target: { clientId: string; vars: Record<string, string>; templateId?: string } | null; onClose: () => void }) {
  const { db, run } = useDemo();
  const [tplId, setTplId] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Interaction["channel"]>("sms");
  useEffect(() => {
    if (!target) return;
    const tpl = db.templates.find((t) => t.id === target.templateId) ?? db.templates[0];
    setTplId(tpl.id);
    setChannel(tpl.channel);
    setBody(renderTemplate(tpl, target.vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  if (!target) return null;
  const client = db.clients.find((c) => c.id === target.clientId);
  const prefs = client?.commPrefs;
  const allowed = { sms: prefs?.sms, whatsapp: prefs?.whatsapp, email: prefs?.email, appel: prefs?.call, visite: true }[channel];
  return (
    <AppModal
      isOpen={!!target}
      onClose={onClose}
      title="Préparer un message (simulation)"
      description={client ? `${client.name} · ${client.phoneCode} ${client.phone}` : undefined}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Fermer</Button>
          <Button size="sm" disabled={!allowed || !body.trim()} onClick={() => run(logSimulatedMessage, { clientId: target.clientId, channel, body }).ok && onClose()}>Enregistrer l&apos;envoi simulé</Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice tone="warning">Aucun SMS, WhatsApp ou e-mail n&apos;est envoyé. L&apos;action est uniquement consignée dans l&apos;historique des interactions comme « simulation ».</DemoNotice>
        <FormGrid>
          <SelectField label="Modèle" value={tplId} onChange={(x) => { const t = db.templates.find((y) => y.id === x); if (t) { setTplId(x); setChannel(t.channel); setBody(renderTemplate(t, target.vars)); } }} options={db.templates.map((t) => ({ value: t.id, label: t.name }))} />
          <SelectField label="Canal" value={channel} onChange={(x) => setChannel(x as Interaction["channel"])} options={[{ value: "sms", label: `SMS${prefs?.sms ? "" : " (non autorisé)"}` }, { value: "whatsapp", label: `WhatsApp${prefs?.whatsapp ? "" : " (non autorisé)"}` }, { value: "email", label: `E-mail${prefs?.email ? "" : " (non autorisé)"}` }]} />
        </FormGrid>
        <TextAreaField label="Message" value={body} onChange={setBody} rows={4} />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-white/3">
          <p className="mb-1 text-theme-xs font-medium text-gray-500 uppercase">Aperçu avant envoi</p>
          <p className="whitespace-pre-wrap text-gray-800 dark:text-white/90">{body}</p>
        </div>
        {!allowed && <p className="text-theme-xs text-error-600">Ce canal n&apos;est pas autorisé dans les préférences de communication du client.</p>}
      </div>
    </AppModal>
  );
}
