"use client";

import { careSummary, careTarget, CARE_STATUS } from "@/lib/care";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { clientName, userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { REPORT_SECTIONS, RURAL_LABEL, ruralTypeOf, SEVERITY } from "@/lib/rural";
import { addMissionPhoto, MAX_REPORT_PHOTOS, updateMissionPhoto } from "@/lib/services/missionsService";
import type { Mission } from "@/lib/types";
import { compressImage } from "@/utils/image";
import { useToast } from "@/context/ToastContext";
import { useState } from "react";

/** Photos du rapport : prise de vue au téléphone ou import, légende et rubrique. */
export function ReportPhotos({ m }: { m: Mission }) {
  const { run, can } = useDemo();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const editable = can("missions", "update") && m.status !== "annulee";
  const sections = REPORT_SECTIONS[ruralTypeOf(m)];
  const photos = m.photos ?? [];
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, MAX_REPORT_PHOTOS - photos.length)) {
        const dataUrl = await compressImage(f);
        run(addMissionPhoto, { id: m.id, dataUrl, caption: "" }, { silent: true });
      }
    } catch (e) {
      toast.show("error", e instanceof Error ? e.message : "Image non ajoutée.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
          Photos ({photos.length}/{MAX_REPORT_PHOTOS}) <span className="font-normal text-gray-500">— lésions, bâtiments, abreuvoirs, étiquettes…</span>
        </p>
        {editable && photos.length < MAX_REPORT_PHOTOS && (
          <label className="cliva-press inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">
            {busy ? "Ajout…" : "Ajouter des photos"}
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="cliva-rise overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- photo locale (data URL) */}
              <img src={p.dataUrl} alt={p.caption || "Photo du rapport"} className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-1.5 p-2">
                <input aria-label="Légende" placeholder="Légende" defaultValue={p.caption} disabled={!editable} onBlur={(e) => e.target.value !== p.caption && run(updateMissionPhoto, { id: m.id, photoId: p.id, caption: e.target.value }, { silent: true })} className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2 text-theme-xs dark:border-gray-700 dark:text-white/90" />
                <div className="flex items-center gap-1">
                  <select aria-label="Rubrique" value={p.section ?? ""} disabled={!editable} onChange={(e) => run(updateMissionPhoto, { id: m.id, photoId: p.id, section: e.target.value }, { silent: true })} className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-transparent px-1 text-[11px] dark:border-gray-700 dark:text-white/90">
                    <option value="">Rubrique…</option>
                    {sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  {editable && <button onClick={() => run(updateMissionPhoto, { id: m.id, photoId: p.id, remove: true })} className="px-1 text-[11px] text-gray-400 hover:text-error-600">Retirer</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Photo({ p }: { p: NonNullable<Mission["photos"]>[number] }) {
  return (
    <figure className="break-inside-avoid">
      {/* eslint-disable-next-line @next/next/no-img-element -- photo locale */}
      <img src={p.dataUrl} alt={p.caption} className="aspect-[4/3] w-full rounded border border-gray-300 object-cover" />
      {p.caption && <figcaption className="mt-0.5 text-[10px] text-gray-600">{p.caption}</figcaption>}
    </figure>
  );
}

/** Rapport imprimable (A4) : exploitation, équipe, effectifs, rubriques, photos, actions à mener, signatures. */
export function ReportPrintButton({ m }: { m: Mission }) {
  const { db } = useDemo();
  const [open, setOpen] = useState(false);
  const type = ruralTypeOf(m);
  const farms = db.farms.filter((f) => m.farmIds.includes(f.id));
  const client = m.clientIds[0] ? clientName(db, m.clientIds[0]) : farms[0] ? clientName(db, farms[0].clientId) : "";
  const sections = REPORT_SECTIONS[type].filter((s) => (m.reportSections?.[s.key] ?? "").trim());
  const photos = m.photos ?? [];
  const loose = photos.filter((p) => !p.section || !sections.some((s) => s.key === p.section));
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Imprimer le rapport</Button>
      <PrintFrame open={open} onClose={() => setOpen(false)} title={`Rapport ${m.code}`}>
        <PrintHeader title={type === "visite" ? "Rapport de visite de ferme" : type === "urgence" ? "Rapport d'intervention d'urgence" : "Rapport de mission"} sub={<p>{m.code} · {formatDate(m.date)}</p>} />
        <table className="mt-3 w-full text-[11px]">
          <tbody>
            <tr><td className="w-36 py-0.5 text-gray-600">Éleveur</td><td className="py-0.5 font-medium">{client}</td></tr>
            <tr><td className="py-0.5 text-gray-600">Exploitation(s)</td><td className="py-0.5">{farms.map((f) => `${f.name}${f.location ? ` (${f.location})` : ""}`).join(" ; ") || m.location}</td></tr>
            <tr><td className="py-0.5 text-gray-600">Objet</td><td className="py-0.5">{m.objective}</td></tr>
            <tr><td className="py-0.5 text-gray-600">Équipe</td><td className="py-0.5">{[m.leaderId, ...m.teamIds.filter((x) => x !== m.leaderId)].map((u) => userName(db, u)).join(", ")}</td></tr>
            {m.emergency && <tr><td className="py-0.5 text-gray-600">Appel</td><td className="py-0.5">{formatDateTime(m.emergency.calledAt)} · {m.emergency.caller} · gravité {SEVERITY[m.emergency.severity]?.label ?? m.emergency.severity} · {m.emergency.reason}</td></tr>}
          </tbody>
        </table>
        {(m.interventionsDone.length > 0 || m.observedHeadcounts.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            {m.interventionsDone.length > 0 && (
              <div>
                <h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Interventions réalisées</h2>
                <ul className="list-disc ps-4">{m.interventionsDone.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {m.observedHeadcounts.length > 0 && (
              <div>
                <h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Effectifs observés</h2>
                <ul>{m.observedHeadcounts.map((o, i) => <li key={i}>{o.lotLabel} : <strong>{o.count}</strong></li>)}</ul>
              </div>
            )}
          </div>
        )}
        {(db.careCases ?? []).filter((c) => c.missionId === m.id).length > 0 && (
          <section className="mt-3 break-inside-avoid">
            <h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Consultations et prises en charge</h2>
            {(db.careCases ?? []).filter((c) => c.missionId === m.id).map((c) => (
              <div key={c.id} className="mb-2">
                <p className="font-semibold">{c.code} · {careTarget(db, c)}</p>
                <p className="whitespace-pre-line">{careSummary(db, c).split("\n").slice(1).join("\n")}</p>
                <p className="text-gray-600">Suivi : {c.status === "en_cours" ? `prochaines nouvelles le ${formatDate(c.nextCheck)}` : CARE_STATUS[c.status].label}</p>
              </div>
            ))}
          </section>
        )}
        {sections.map((s) => {
          const ph = photos.filter((p) => p.section === s.key);
          return (
            <section key={s.key} className="mt-3 break-inside-avoid">
              <h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">{s.label}</h2>
              <p className="whitespace-pre-line">{m.reportSections![s.key]}</p>
              {ph.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">{ph.map((p) => <Photo key={p.id} p={p} />)}</div>}
            </section>
          );
        })}
        {loose.length > 0 && (
          <section className="mt-3">
            <h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Photos</h2>
            <div className="grid grid-cols-3 gap-2">{loose.map((p) => <Photo key={p.id} p={p} />)}</div>
          </section>
        )}
        {m.actionItems.length > 0 && (
          <section className="mt-3 break-inside-avoid">
            <h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Actions à mener</h2>
            <table className="w-full text-[11px]">
              <tbody>
                {m.actionItems.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="w-5 py-0.5">{a.done ? "☑" : "☐"}</td>
                    <td className="py-0.5">{a.label}</td>
                    <td className="py-0.5 text-gray-600">{a.assigneeId ? userName(db, a.assigneeId) : ""}</td>
                    <td className="py-0.5 text-end text-gray-600">{a.dueDate ? formatDate(a.dueDate) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <div className="mt-8 grid grid-cols-2 gap-8 break-inside-avoid text-[11px]">
          <div className="border-t border-gray-400 pt-1">Le vétérinaire : {userName(db, m.leaderId)}</div>
          <div className="border-t border-gray-400 pt-1">L&apos;éleveur : {client}</div>
        </div>
        <p className="mt-4 text-[10px] text-gray-500">{db.settings.documentFooter} · {RURAL_LABEL[type]} {m.code}</p>
      </PrintFrame>
    </>
  );
}
