"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { PROJECT_STATUS, projectSpend, proofCount } from "@/lib/projects";
import type { ProjectInput } from "@/lib/services/projectsService";
import type { Project } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import ProjectModal, { EMPTY_PROJECT } from "./ProjectModal";

function ProjectCard({ p, onEdit, onPrint }: { p: Project; onEdit: () => void; onPrint: () => void }) {
  const { db, can } = useDemo();
  const router = useRouter();
  const s = projectSpend(db, p);
  const over = s.left !== undefined && s.left < 0;
  return (
    <li className="cliva-rise flex flex-col gap-3 rounded-3xl border border-gray-200/70 bg-white p-5 shadow-cliva dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">{p.code}{p.ownerId && ` · ${userName(db, p.ownerId)}`}</p>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{p.name}</h3>
          {p.description && <p className="mt-0.5 text-theme-sm text-gray-500">{p.description}</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PROJECT_STATUS[p.status].tone)}>{PROJECT_STATUS[p.status].label}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-theme-xs text-gray-500">Dépensé (validé)</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatXOF(s.spent)}</p>
          {s.pending > 0 && <p className="text-theme-xs text-warning-600">+ {formatXOF(s.pending)} en attente du DG</p>}
        </div>
        {p.budget ? (
          <div className="text-end">
            <p className="text-theme-xs text-gray-500">Enveloppe {formatXOF(p.budget)}</p>
            <p className={cn("text-sm font-semibold tabular-nums", over ? "text-error-600" : "text-success-600")}>{over ? `Dépassement ${formatXOF(-(s.left ?? 0))}` : `Reste ${formatXOF(s.left ?? 0)}`}</p>
          </div>
        ) : null}
      </div>
      {p.budget ? (
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Consommation de l'enveloppe">
          <div className={cn("h-full rounded-full", over ? "bg-error-500" : (s.pct ?? 0) > 85 ? "bg-warning-500" : "bg-brand-500")} style={{ width: `${Math.min(100, s.pct ?? 0)}%` }} />
        </div>
      ) : null}
      <p className="text-theme-xs text-gray-500">
        {s.list.length} dépense(s){s.withoutProof > 0 && <span className="font-medium text-warning-600"> · {s.withoutProof} sans preuve</span>}
        {p.startDate && ` · du ${formatDate(p.startDate)}`}
        {p.endDate && ` au ${formatDate(p.endDate)}`}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5">
        <Button size="xs" variant="soft" onClick={() => router.push(`/finances/depenses?projet=${p.id}`)}>Voir les dépenses</Button>
        {p.driveUrl && <a href={p.driveUrl} target="_blank" rel="noreferrer" className="cliva-press inline-flex h-7 items-center rounded-lg border border-gray-300 px-2.5 text-theme-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">Dossier Drive</a>}
        <Button size="xs" variant="ghost" onClick={onPrint}>Imprimer</Button>
        {can("finances", "create") && <Button size="xs" variant="ghost" onClick={onEdit}>Modifier</Button>}
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const { db, can } = useDemo();
  const [edit, setEdit] = useState<ProjectInput | null>(null);
  const [print, setPrint] = useState<Project | null>(null);
  const [tab, setTab] = useState<"actifs" | "termines">("actifs");
  const all = db.projects ?? [];
  const list = all.filter((p) => (tab === "actifs" ? p.status !== "termine" : p.status === "termine"));
  const ps = print ? projectSpend(db, print) : null;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Projets"
        subtitle="Rattachez vos dépenses à un projet pour en suivre le coût réel et les preuves"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={can("finances", "create") && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit({ ...EMPTY_PROJECT })}>Nouveau projet</Button>}
      />
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
        {(["actifs", "termines"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === t ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>
            {t === "actifs" ? `En cours (${all.filter((p) => p.status !== "termine").length})` : `Terminés (${all.filter((p) => p.status === "termine").length})`}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {list.map((p) => <ProjectCard key={p.id} p={p} onEdit={() => setEdit({ ...p })} onPrint={() => setPrint(p)} />)}
      </ul>
      {!list.length && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucun projet.</p>}
      <ProjectModal value={edit} onClose={() => setEdit(null)} />
      <PrintFrame open={!!print} onClose={() => setPrint(null)} title="Dépenses du projet">
        {print && ps && (
          <>
            <PrintHeader title={`Projet ${print.code}`} sub={<p className="font-semibold">{print.name}</p>} />
            <p className="mt-3">
              Dépensé : <strong>{formatXOF(ps.spent)}</strong>
              {ps.pending > 0 && <> · en attente : {formatXOF(ps.pending)}</>}
              {print.budget ? <> · enveloppe : {formatXOF(print.budget)} · reste : {formatXOF(ps.left ?? 0)}</> : null}
            </p>
            <table className="mt-3 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-gray-900">{["Réf.", "Date", "Libellé", "Catégorie", "Montant", "Statut", "Preuves"].map((h, i) => <th key={h} className={cn("py-1 pe-2 font-semibold", i === 4 ? "text-end" : "text-start")}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {[...ps.list].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
                  <tr key={e.id} className="border-b border-gray-200 align-top">
                    <td className="py-1 pe-2">{e.code}</td>
                    <td className="py-1 pe-2">{formatDate(e.date)}</td>
                    <td className="py-1 pe-2">{e.label}</td>
                    <td className="py-1 pe-2">{e.category}</td>
                    <td className="py-1 pe-2 text-end">{formatXOF(e.amount)}</td>
                    <td className="py-1 pe-2">{e.status === "approuvee" ? "Validée" : "En attente"}</td>
                    <td className="py-1 pe-2">
                      {proofCount(e) === 0 ? "À fournir" : [e.photos?.length && `${e.photos.length} photo(s)`, ...(e.proofLinks ?? []).map((l) => l.url)].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </PrintFrame>
    </div>
  );
}
