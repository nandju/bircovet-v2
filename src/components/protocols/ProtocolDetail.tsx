"use client";

import ExternalLinks from "@/components/documents/ExternalLinks";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PrinterIcon } from "@/icons";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { linkKind, PROTOCOL_CATS } from "@/lib/protocols";
import { setProtocolStatus } from "@/lib/services/protocolsService";
import { cn } from "@/utils";
import { useState } from "react";
import ProtocolEditor from "./ProtocolEditor";
import type { ProtocolInput } from "@/lib/services/protocolsService";

export default function ProtocolDetail({ id }: { id: string }) {
  const { db, run, user } = useDemo();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<ProtocolInput | null>(null);
  const [print, setPrint] = useState(false);
  const p = (db.protocols ?? []).find((x) => x.id === id);
  if (!p) return <p className="text-sm text-gray-500">Fiche introuvable.</p>;
  const canValidate = user?.roleId === "dg" || user?.roleId === "vet";
  const toggle = (sid: string) => setDone((s) => { const n = new Set(s); if (n.has(sid)) n.delete(sid); else n.add(sid); return n; });
  const pct = p.steps.length ? Math.round((p.steps.filter((s) => done.has(s.id)).length / p.steps.length) * 100) : 0;
  const body = (paper: boolean) => (
    <>
      {p.summary && <p className={cn("rounded-xl p-3 text-sm", paper ? "border border-gray-300" : "bg-brand-25 text-gray-800 dark:bg-brand-500/10 dark:text-white/90")}><strong>À retenir : </strong>{p.summary}</p>}
      <h3 className="mt-4 text-sm font-semibold">Étapes</h3>
      <ol className="mt-2 space-y-1.5">
        {p.steps.map((s, i) => (
          <li key={s.id}>
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5", !paper && "hover:bg-gray-50 dark:hover:bg-white/5", s.critical && !paper && "bg-error-25 dark:bg-error-500/5")}>
              {paper ? <span className="mt-0.5 inline-block size-4 shrink-0 border border-gray-500" /> : <input type="checkbox" checked={done.has(s.id)} onChange={() => toggle(s.id)} className="mt-0.5 size-4 accent-brand-500" />}
              <span className={cn("text-sm", done.has(s.id) && !paper && "text-gray-400 line-through")}>
                <span className="me-1 font-semibold tabular-nums">{i + 1}.</span>
                {s.text}
                {s.critical && <span className={cn("ms-2 rounded px-1 text-[10px] font-bold uppercase", paper ? "border border-gray-700" : "bg-error-500 text-white")}>critique</span>}
              </span>
            </label>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
        {p.materials.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Matériel</h3>
            <ul className="mt-1 list-disc ps-5 text-sm">{p.materials.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        {p.warnings && (
          <div>
            <h3 className="text-sm font-semibold">Points de vigilance</h3>
            <p className="mt-1 text-sm whitespace-pre-wrap">{p.warnings}</p>
          </div>
        )}
      </div>
      {p.links.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Ressources</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {p.links.map((l) => <li key={l.url}>{paper ? `${l.label} : ${l.url}` : <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline"><span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", linkKind(l.url).tone)}>{linkKind(l.url).label}</span>{l.label} ↗</a>}</li>)}
          </ul>
        </div>
      )}
    </>
  );
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={p.title}
        subtitle={`${p.code} · ${PROTOCOL_CATS[p.category].label}${p.subject ? ` · ${p.subject}` : ""} · version ${p.version} du ${formatDate(p.updatedAt)}`}
        trail={[{ label: "Protocoles et fiches", href: "/protocoles" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer</Button>
            <Button size="sm" variant="outline" onClick={() => setEdit({ ...p })}>Modifier</Button>
            {canValidate && p.status !== "valide" && <Button size="sm" onClick={() => run(setProtocolStatus, { id: p.id, status: "valide" })}>Valider</Button>}
            {canValidate && p.status !== "archive" && <Button size="sm" variant="ghost" onClick={() => run(setProtocolStatus, { id: p.id, status: "archive" })}>Archiver</Button>}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <article className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-5 text-gray-800 dark:border-gray-800 dark:bg-white/3 dark:text-white/90">{body(false)}</article>
        <aside className="space-y-3">
          <div className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">Mode check-list</p>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">{pct} %</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-theme-xs text-gray-500">Cochez les étapes au fur et à mesure (non enregistré).</p>
            {done.size > 0 && <Button size="xs" variant="ghost" className="mt-1" onClick={() => setDone(new Set())}>Recommencer</Button>}
          </div>
          <div className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 text-theme-xs text-gray-600 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">
            <p><strong>Statut :</strong> {p.status === "valide" ? "validée" : p.status === "brouillon" ? "brouillon (à valider)" : "archivée"}</p>
            <p><strong>Rédigée par :</strong> {userName(db, p.authorId)}</p>
            {p.validatedById && <p><strong>Validée par :</strong> {userName(db, p.validatedById)}</p>}
            {p.species.length > 0 && <p><strong>Espèces :</strong> {p.species.join(", ")}</p>}
          </div>
          <ExternalLinks refTo={{ kind: "protocole", id: p.id }} title="Documents liés (Google Drive…)" />
        </aside>
      </div>
      <ProtocolEditor value={edit} onClose={() => setEdit(null)} />
      <PrintFrame open={print} onClose={() => setPrint(false)} title={p.title}>
        <PrintHeader title={p.title} sub={`${p.code} · ${PROTOCOL_CATS[p.category].label} · version ${p.version}`} />
        <div className="mt-4">{body(true)}</div>
      </PrintFrame>
    </div>
  );
}
