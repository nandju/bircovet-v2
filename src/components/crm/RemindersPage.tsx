"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { clientName, invoiceBalance, patientName } from "@/lib/calc";
import { addDays, daysBetween, formatDate, formatDateTime, formatXOF } from "@/lib/format";
import type { TaskInput } from "@/lib/services/tasksService";
import { useMemo, useState } from "react";
import { MessageModal, TaskModal } from "./CrmModals";

interface Item {
  key: string;
  clientId: string;
  title: string;
  sub: string;
  href?: string;
  vars: Record<string, string>;
  templateId: string;
  task: Partial<TaskInput>;
}

export default function RemindersPage() {
  const { db, today, can } = useDemo();
  const [msg, setMsg] = useState<{ clientId: string; vars: Record<string, string>; templateId?: string } | null>(null);
  const [taskPreset, setTaskPreset] = useState<Partial<TaskInput> | null>(null);

  const sections = useMemo(() => {
    const vac: Item[] = db.patients
      .filter((p) => p.vitalStatus === "vivant")
      .flatMap((p) => p.vaccinations.filter((v) => v.nextDue && v.nextDue <= addDays(today, 30)).map((v) => ({ p, v })))
      .map(({ p, v }) => ({ key: `vac-${v.id}`, clientId: p.ownerId, title: `${p.name} — ${v.name}`, sub: `Rappel saisi pour le ${formatDate(v.nextDue)}${v.nextDue! < today ? " (dépassé)" : ""} · ${clientName(db, p.ownerId)}`, href: `/patients/${p.id}`, vars: { client: clientName(db, p.ownerId), patient: p.name, date: formatDate(v.nextDue) }, templateId: "tpl-2", task: { title: `Rappel vaccinal — ${p.name}`, category: "rappel", clientId: p.ownerId, patientId: p.id } }));
    const rdv: Item[] = db.appointments
      .filter((a) => a.start.slice(0, 10) > today && a.start.slice(0, 10) <= addDays(today, 3) && a.status !== "annule" && a.reminder.enabled)
      .map((a) => ({ key: `rdv-${a.id}`, clientId: a.clientId, title: `${patientName(db, a.patientId)} — ${a.reason}`, sub: `${formatDateTime(a.start)} · rappel ${a.reminder.channel} ${a.reminder.offsetHours} h avant${a.reminder.simulatedAt ? " · déjà simulé" : ""}`, href: "/agenda", vars: { client: clientName(db, a.clientId), patient: patientName(db, a.patientId), date: formatDateTime(a.start) }, templateId: "tpl-1", task: { title: `Rappel RDV — ${patientName(db, a.patientId)}`, category: "rappel", clientId: a.clientId } }));
    const unpaid: Item[] = db.invoices
      .filter((i) => i.status === "en_retard")
      .map((i) => ({ key: `inv-${i.id}`, clientId: i.clientId, title: `${i.code} — ${clientName(db, i.clientId)}`, sub: `Échue depuis ${daysBetween(i.dueDate, today)} j · solde ${formatXOF(invoiceBalance(db, i))}`, href: `/facturation/factures/${i.id}`, vars: { client: clientName(db, i.clientId), facture: i.code, montant: formatXOF(invoiceBalance(db, i)) }, templateId: "tpl-3", task: { title: `Relance impayé ${i.code}`, category: "impaye", clientId: i.clientId, priority: "haute" } }));
    const followCons: Item[] = db.consultations
      .filter((c) => c.followUpDate && c.followUpDate >= addDays(today, -7) && c.followUpDate <= addDays(today, 14))
      .map((c) => ({ key: `fc-${c.id}`, clientId: c.clientId, title: `${patientName(db, c.patientId)} — contrôle après ${c.code}`, sub: `Contrôle recommandé le ${formatDate(c.followUpDate)}`, href: `/consultations/${c.id}`, vars: { client: clientName(db, c.clientId), patient: patientName(db, c.patientId) }, templateId: "tpl-4", task: { title: `Suivi consultation ${c.code}`, category: "suivi_consultation", clientId: c.clientId, patientId: c.patientId } }));
    const followHosp: Item[] = db.hospitalizations
      .filter((h) => h.followUp && !h.followUp.done)
      .map((h) => ({ key: `fh-${h.id}`, clientId: h.clientId, title: `${patientName(db, h.patientId)} — suivi après ${h.code}`, sub: `Prévu le ${formatDate(h.followUp!.date)} · ${h.followUp!.notes}`, href: `/hospitalisation/${h.id}`, vars: { client: clientName(db, h.clientId), patient: patientName(db, h.patientId) }, templateId: "tpl-5", task: { title: `Suivi post-hospitalisation ${h.code}`, category: "suivi_hospitalisation", clientId: h.clientId, patientId: h.patientId } }));
    const inactive: Item[] = db.clients
      .filter((c) => c.status === "actif" && c.lastActivityAt < addDays(today, -180))
      .map((c) => ({ key: `ina-${c.id}`, clientId: c.id, title: c.name, sub: `Dernière activité : ${formatDate(c.lastActivityAt)}`, href: `/clients/${c.id}`, vars: { client: c.name, patient: "" }, templateId: "tpl-4", task: { title: `Relance client inactif — ${c.name}`, category: "relance_inactif", clientId: c.id } }));
    return [
      { title: "Rappels vaccinaux (échéances saisies)", items: vac },
      { title: "Rappels de rendez-vous (72 h)", items: rdv },
      { title: "Suivi des impayés", items: unpaid },
      { title: "Suivi après consultation", items: followCons },
      { title: "Suivi après hospitalisation", items: followHosp },
      { title: "Clients inactifs (> 6 mois)", items: inactive },
    ];
  }, [db, today]);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Rappels et messages" trail={[{ label: "Relation client", href: "/relation-client" }]} />
      <DemoNotice>Rappels configurables et messages fictifs avec aperçu. Aucun message n&apos;est réellement envoyé. Les rappels vaccinaux reposent uniquement sur les échéances saisies par le vétérinaire.</DemoNotice>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {sections.map((s) => (
          <ComponentCard key={s.title} title={`${s.title} (${s.items.length})`} bodyClassName="p-2 sm:p-3">
            {s.items.length === 0 ? (
              <EmptyState title="Rien à traiter" />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {s.items.slice(0, 8).map((it) => (
                  <li key={it.key} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2.5">
                    <span className="min-w-0">
                      {it.href ? <Link href={it.href} className="block truncate text-sm font-medium text-gray-800 hover:underline dark:text-white/90">{it.title}</Link> : <span className="text-sm font-medium">{it.title}</span>}
                      <span className="block text-theme-xs text-gray-500">{it.sub}</span>
                    </span>
                    <span className="flex gap-1">
                      <Button size="xs" variant="soft" onClick={() => setMsg({ clientId: it.clientId, vars: it.vars, templateId: it.templateId })}>Message</Button>
                      {can("relation", "update") && <Button size="xs" variant="ghost" onClick={() => setTaskPreset(it.task)}>Tâche</Button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ComponentCard>
        ))}
      </div>
      <ComponentCard title="Modèles de messages (fictifs)">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {db.templates.map((t) => (
            <li key={t.id} className="rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-800">
              <p className="font-medium text-gray-800 dark:text-white/90">{t.name} <span className="text-theme-xs font-normal text-gray-500">({t.channel})</span></p>
              <p className="mt-1 text-gray-600 dark:text-gray-400">{t.body}</p>
            </li>
          ))}
        </ul>
      </ComponentCard>
      <MessageModal target={msg} onClose={() => setMsg(null)} />
      <TaskModal isOpen={!!taskPreset} onClose={() => setTaskPreset(null)} preset={taskPreset ?? undefined} />
    </div>
  );
}
