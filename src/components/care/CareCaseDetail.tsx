"use client";

import AppModal from "@/components/common/AppModal";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { clientName, userName } from "@/lib/calc";
import { careTarget, CARE_REASON, CARE_STATUS, FOLLOW_STATE } from "@/lib/care";
import { formatDate } from "@/lib/format";
import { closeCareCase, logCareFollowUp } from "@/lib/services/careService";
import type { CareCase, CareFollowUp } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import type { CarePrefill } from "./CareCaseModal";

const inp = "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";

export function CareSheet({ c }: { c: CareCase }) {
  const { db } = useDemo();
  const f = db.farms.find((x) => x.id === c.farmId);
  return (
    <>
      <PrintHeader title="Fiche de prise en charge" sub={<p>{c.code} · {formatDate(c.openedAt)}</p>} />
      <table className="mt-3 w-full text-[11px]"><tbody>
        <tr><td className="w-40 py-0.5 text-gray-600">Éleveur / exploitation</td><td className="py-0.5 font-medium">{f ? `${clientName(db, f.clientId)} — ${f.name} (${f.location})` : ""}</td></tr>
        <tr><td className="py-0.5 text-gray-600">Objet</td><td className="py-0.5">{CARE_REASON[c.reason].label}</td></tr>
        <tr><td className="py-0.5 text-gray-600">Animaux</td><td className="py-0.5">{careTarget(db, c)}</td></tr>
        <tr><td className="py-0.5 text-gray-600">Vétérinaire</td><td className="py-0.5">{userName(db, c.vetId)}</td></tr>
      </tbody></table>
      {[["Motif", c.complaint], ["Examen", [c.exam.temperature && `T° ${c.exam.temperature} °C`, c.exam.heartRate && `FC ${c.exam.heartRate}/min`, c.exam.respRate && `FR ${c.exam.respRate}/min`, c.exam.findings].filter(Boolean).join(" · ")], ["Diagnostic", c.diagnosis]].filter(([, x]) => x).map(([k, x]) => (
        <section key={k} className="mt-3"><h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">{k}</h2><p className="whitespace-pre-line">{x}</p></section>
      ))}
      {c.treatments.length > 0 && (
        <section className="mt-3"><h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Traitement</h2>
          <table className="w-full text-[11px]"><thead><tr className="text-start">{["Produit", "Dose", "Voie", "Durée", "Animaux"].map((h) => <th key={h} className="py-0.5 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody>{c.treatments.map((t) => <tr key={t.id}><td className="py-0.5">{t.product}</td><td>{t.dose}</td><td>{t.route}</td><td>{t.duration}</td><td>{t.count}</td></tr>)}</tbody></table>
        </section>
      )}
      {c.advice && <section className="mt-3"><h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Conseils et recommandations</h2><p className="whitespace-pre-line">{c.advice}</p></section>}
      {c.followUps.length > 0 && (
        <section className="mt-3"><h2 className="mb-1 border-b border-gray-300 text-[12px] font-bold">Suivi</h2>
          <ul>{c.followUps.map((u) => <li key={u.id}>{formatDate(u.date)} · {FOLLOW_STATE[u.state].label}{u.sick ? ` · ${u.sick} malade(s)` : ""}{u.dead ? ` · ${u.dead} mort(s)` : ""} — {u.note}</li>)}</ul>
        </section>
      )}
      <p className="mt-4 text-[11px] text-gray-600">Prochain point : {c.nextCheck ? formatDate(c.nextCheck) : "—"} · En cas d&apos;aggravation, appelez le cabinet.</p>
    </>
  );
}

export default function CareCaseDetail({ id, onClose, onExtend }: { id: string | null; onClose: () => void; onExtend: (p: CarePrefill) => void }) {
  const { db, run } = useDemo();
  const [fu, setFu] = useState({ channel: "appel" as CareFollowUp["channel"], state: "amelioration" as CareFollowUp["state"], sick: NaN, dead: NaN, note: "", next: 3 });
  const [closing, setClosing] = useState("");
  const [print, setPrint] = useState(false);
  const c = id ? (db.careCases ?? []).find((x) => x.id === id) : undefined;
  if (!c) return null;
  const f = db.farms.find((x) => x.id === c.farmId);
  const phone = (f?.managerPhone ?? "").replace(/[^\d+]/g, "");
  const wa = phone ? `https://wa.me/${phone.replace(/^\+/, "").replace(/^0/, "225")}?text=${encodeURIComponent(`Bonjour ${f?.managerName ?? ""}, c'est le cabinet vétérinaire. Comment vont les animaux depuis notre passage (${careTarget(db, c)}) ?`)}` : "";
  const parent = c.parentId ? db.careCases?.find((x) => x.id === c.parentId) : undefined;
  const children = (db.careCases ?? []).filter((x) => x.parentId === c.id);
  const open = c.status === "en_cours";
  const save = () => {
    if (run(logCareFollowUp, { caseId: c.id, channel: fu.channel, state: fu.state, sick: Number.isFinite(fu.sick) ? fu.sick : undefined, dead: Number.isFinite(fu.dead) ? fu.dead : undefined, note: fu.note, nextCheckDays: fu.next }).ok) setFu({ ...fu, note: "", sick: NaN, dead: NaN });
  };
  return (
    <>
      <AppModal isOpen={!print} onClose={onClose} size="xl" title={`${c.code} — ${careTarget(db, c)}`} description={`${f?.name ?? ""} · ${CARE_REASON[c.reason].label} · ${formatDate(c.openedAt)} · ${userName(db, c.vetId)}`}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-theme-xs font-medium", CARE_STATUS[c.status].tone)}>{CARE_STATUS[c.status].label}</span>
            {open && c.nextCheck && <span className="text-theme-sm text-gray-600 dark:text-gray-400">Prochaines nouvelles : <strong>{formatDate(c.nextCheck)}</strong></span>}
            <span className="ms-auto flex flex-wrap gap-1.5">
              {phone && <a href={`tel:${phone}`} className="cliva-press inline-flex h-8 items-center rounded-lg border border-gray-300 px-3 text-theme-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">📞 Appeler {f?.managerName}</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="cliva-press inline-flex h-8 items-center rounded-lg border border-success-300 px-3 text-theme-sm font-medium text-success-700 dark:border-success-500/40 dark:text-success-400">WhatsApp</a>}
              <Button size="xs" variant="outline" onClick={() => setPrint(true)}>Imprimer la fiche</Button>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5 rounded-2xl bg-gray-50 p-3 text-sm dark:bg-white/5">
              {c.complaint && <p><span className="text-gray-500">Motif : </span>{c.complaint}</p>}
              {(c.exam.temperature || c.exam.heartRate || c.exam.respRate) && <p className="tabular-nums"><span className="text-gray-500">Constantes : </span>{[c.exam.temperature && `T° ${c.exam.temperature} °C`, c.exam.heartRate && `FC ${c.exam.heartRate}`, c.exam.respRate && `FR ${c.exam.respRate}`].filter(Boolean).join(" · ")}</p>}
              {c.exam.findings && <p><span className="text-gray-500">Examen : </span>{c.exam.findings}</p>}
              {c.diagnosis && <p><span className="text-gray-500">Diagnostic : </span><strong>{c.diagnosis}</strong></p>}
            </div>
            <div className="space-y-1.5 rounded-2xl bg-gray-50 p-3 text-sm dark:bg-white/5">
              <p className="text-gray-500">Traitement</p>
              <ul className="space-y-0.5">{c.treatments.map((t) => <li key={t.id}>• {[t.product, t.dose, t.route, t.duration && `${t.duration}`].filter(Boolean).join(" · ")} <span className="text-gray-500">({t.count})</span></li>)}{!c.treatments.length && <li className="text-gray-400">—</li>}</ul>
              {c.advice && <p className="pt-1"><span className="text-gray-500">Conseils : </span>{c.advice}</p>}
            </div>
          </div>
          {(parent || children.length > 0) && (
            <p className="rounded-xl bg-orange-25 px-3 py-2 text-theme-sm text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
              {parent && <>Fait suite à <strong>{parent.code}</strong> ({careTarget(db, parent)}). </>}
              {children.length > 0 && <>Étendue à : {children.map((x) => `${x.code} (${careTarget(db, x)})`).join(", ")}.</>}
            </p>
          )}
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Nouvelles</h4>
            <ol className="space-y-2 border-s-2 border-orange-200 ps-4 dark:border-orange-500/30">
              <li className="text-theme-sm"><span className="text-gray-500">{formatDate(c.openedAt)}</span> · Intervention — {CARE_REASON[c.reason].label}</li>
              {c.followUps.map((u) => (
                <li key={u.id} className="text-theme-sm">
                  <span className="text-gray-500">{formatDate(u.date)} · {u.channel === "appel" ? "Appel" : u.channel === "whatsapp" ? "WhatsApp" : "Passage"} · {userName(db, u.byId)}</span>
                  <span className={cn("ms-1.5 font-semibold", FOLLOW_STATE[u.state].tone)}>{FOLLOW_STATE[u.state].label}</span>
                  {(u.sick || u.dead) && <span className="ms-1.5 text-gray-600 dark:text-gray-400">{u.sick ? `${u.sick} malade(s)` : ""}{u.sick && u.dead ? " · " : ""}{u.dead ? `${u.dead} mort(s)` : ""}</span>}
                  <span className="block text-gray-700 dark:text-gray-300">{u.note}</span>
                </li>
              ))}
              {c.closedAt && <li className="text-theme-sm"><span className="text-gray-500">{formatDate(c.closedAt)}</span> · {CARE_STATUS[c.status].label}{c.outcome ? ` — ${c.outcome}` : ""}</li>}
            </ol>
          </section>
          {open && (
            <section className="space-y-2 rounded-2xl border border-orange-200 p-3 dark:border-orange-500/30">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Prendre des nouvelles</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select className={cn(inp, "dark:bg-gray-900")} value={fu.channel} onChange={(e) => setFu({ ...fu, channel: e.target.value as CareFollowUp["channel"] })} aria-label="Canal"><option value="appel">Appel</option><option value="whatsapp">WhatsApp</option><option value="visite">Passage</option></select>
                <select className={cn(inp, "dark:bg-gray-900")} value={fu.state} onChange={(e) => setFu({ ...fu, state: e.target.value as CareFollowUp["state"] })} aria-label="État">{Object.entries(FOLLOW_STATE).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}</select>
                {c.scope !== "animal" && <input type="number" min={0} className={inp} value={Number.isFinite(fu.sick) ? fu.sick : ""} onChange={(e) => setFu({ ...fu, sick: e.target.value ? Number(e.target.value) : NaN })} placeholder="Encore malades" aria-label="Encore malades" />}
                {c.scope !== "animal" && <input type="number" min={0} className={inp} value={Number.isFinite(fu.dead) ? fu.dead : ""} onChange={(e) => setFu({ ...fu, dead: e.target.value ? Number(e.target.value) : NaN })} placeholder="Morts depuis" aria-label="Morts depuis" />}
              </div>
              <textarea className={cn(inp, "h-16 py-2")} value={fu.note} onChange={(e) => setFu({ ...fu, note: e.target.value })} placeholder="Ce que dit l'éleveur : appétit, fièvre, mortalité, respect du traitement…" aria-label="Nouvelles" />
              <div className="flex flex-wrap items-center gap-2">
                {fu.state !== "gueri" && fu.state !== "deces" && (
                  <label className="flex items-center gap-1.5 text-theme-sm text-gray-600 dark:text-gray-400">Prochain point dans
                    <select className="h-8 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900" value={fu.next} onChange={(e) => setFu({ ...fu, next: Number(e.target.value) })} aria-label="Prochain point">{[1, 2, 3, 7, 14].map((n) => <option key={n} value={n}>{n} j</option>)}</select>
                  </label>
                )}
                <Button size="sm" className="ms-auto" onClick={save} disabled={!fu.note.trim()}>Enregistrer les nouvelles</Button>
              </div>
            </section>
          )}
          {open && (
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              {c.scope !== "cheptel" && <Button size="sm" variant="outline" onClick={() => onExtend({ farmId: c.farmId, scope: "cheptel", reason: "pathologie", species: c.species, parent: c })}>Prendre en charge tout le cheptel</Button>}
              <input value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Conclusion (pour clôturer)" className={cn(inp, "h-9 min-w-0 flex-1")} aria-label="Conclusion" />
              <Button size="sm" variant="soft" disabled={!closing.trim()} onClick={() => run(closeCareCase, { caseId: c.id, status: "gueri", outcome: closing }).ok && setClosing("")}>Guéri, clôturer</Button>
              <Button size="sm" variant="ghost" disabled={!closing.trim()} onClick={() => run(closeCareCase, { caseId: c.id, status: "cloture", outcome: closing }).ok && setClosing("")}>Clôturer</Button>
            </div>
          )}
        </div>
      </AppModal>
      <PrintFrame open={print} onClose={() => setPrint(false)} title={`Fiche ${c.code}`}>
        <CareSheet c={c} />
      </PrintFrame>
    </>
  );
}
