"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SearchInput from "@/components/common/SearchInput";
import { FormGrid, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon, PrinterIcon } from "@/icons";
import { ADMIN_STATUS, adminSummary, daysLeft, nextObligationDate, PRIORITY, priorityOf } from "@/lib/adminFiles";
import { addDays, formatDate, normalize } from "@/lib/format";
import { saveAdminFile, setAdminFileStatus, setDirectoryLink, toggleObligation, type AdminFileInput } from "@/lib/services/adminFilesService";
import type { AdminFile } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const Chip = ({ className, children }: { className: string; children: React.ReactNode }) => <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", className)}>{children}</span>;

function DriveLink({ url }: { url?: string }) {
  if (!url) return <span className="text-theme-xs text-gray-400">lien à ajouter</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 hover:underline dark:bg-warning-500/15 dark:text-warning-300">Drive ↗</a>;
}

function LinkCell({ id, url }: { id: string; url?: string }) {
  const { run } = useDemo();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(url ?? "");
  if (!edit) return <span className="flex items-center gap-2"><DriveLink url={url} /><button type="button" onClick={() => setEdit(true)} className="text-[11px] text-brand-600 hover:underline">{url ? "modifier" : "coller le lien"}</button></span>;
  return (
    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (run(setDirectoryLink, { id, url: v }).ok) setEdit(false); }}>
      <input aria-label="Lien Drive" value={v} onChange={(e) => setV(e.target.value)} placeholder="https://drive.google.com/…" className="h-8 w-56 rounded-full border border-gray-300 bg-transparent px-3 text-theme-xs dark:border-gray-700" />
      <Button size="xs" type="submit">OK</Button>
    </form>
  );
}

/** Suivi des dossiers administratifs : registre, répertoire Drive, obligations récurrentes. */
export default function AdminFilesPage() {
  const { db, run, today } = useDemo();
  const [tab, setTab] = useState("bord");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  const [edit, setEdit] = useState<AdminFileInput | null>(null);
  const [print, setPrint] = useState(false);
  const s = adminSummary(db, today);
  const files = [...(db.adminFiles ?? [])].sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const cats = [...new Set(files.map((f) => f.category))].sort();
  const t = normalize(q);
  const shown = files.filter((f) => (!cat || f.category === cat) && (!st || (st === "prio" ? ["retard", "urgent"].includes(priorityOf(f, today)) : f.status === st)) && (!t || normalize(`${f.number} ${f.name} ${f.category} ${f.subCategory ?? ""} ${f.description ?? ""} ${f.responsible} ${f.notes ?? ""}`).includes(t)));
  const priority = files.filter((f) => f.status !== "complet" && (priorityOf(f, today) === "retard" || (f.dueDate && f.dueDate <= addDays(today, 60))));
  const dir = db.adminDirectory ?? [];
  const sections = [...new Set(dir.map((e) => e.section))];
  const year = today.slice(0, 4);
  const blank = (): AdminFileInput => ({ name: "", category: cats[0] ?? "Fiscalité & Impôts", year, openedAt: today, dueDate: "", periodicity: "Annuelle", responsible: "", status: "en_cours", driveUrl: "" });
  const row = (f: AdminFile, paper = false) => {
    const p = priorityOf(f, today);
    const d = daysLeft(f.dueDate, today);
    return (
      <tr key={f.id} className="break-inside-avoid border-b border-gray-100 align-top dark:border-gray-800">
        <td className="px-3 py-2 tabular-nums text-gray-500">{f.number}</td>
        <td className="px-3 py-2"><span className="block font-medium text-gray-900 dark:text-white">{f.name}</span><span className="block text-[11px] text-gray-500">{[f.category, f.subCategory].filter(Boolean).join(" · ")}{f.description ? ` — ${f.description}` : ""}</span></td>
        <td className="px-3 py-2 whitespace-nowrap">{formatDate(f.dueDate)}{d !== null && f.status !== "complet" && <span className={cn("block text-[11px]", d < 0 ? "text-error-600" : "text-gray-500")}>{d < 0 ? `${-d} j de retard` : `J-${d}`}</span>}</td>
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{f.periodicity}</td>
        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{f.responsible}</td>
        <td className="px-3 py-2">{paper ? ADMIN_STATUS[f.status].label : <Chip className={ADMIN_STATUS[f.status].chip}>{ADMIN_STATUS[f.status].label}</Chip>}</td>
        <td className="px-3 py-2">{paper ? PRIORITY[p].label : <Chip className={PRIORITY[p].chip}>{PRIORITY[p].label}</Chip>}</td>
        <td className="px-3 py-2">{paper ? (f.driveUrl ? "lien Drive" : "—") : <DriveLink url={f.driveUrl} />}</td>
        {!paper && (
          <td className="px-3 py-2 whitespace-nowrap">
            <Button size="xs" variant="ghost" onClick={() => setEdit({ ...f, driveUrl: f.driveUrl ?? "", dueDate: f.dueDate ?? "" })}>Modifier</Button>
            {f.status !== "complet" && <Button size="xs" variant="soft" onClick={() => run(setAdminFileStatus, { id: f.id, status: "complet" })}>Complété</Button>}
          </td>
        )}
      </tr>
    );
  };
  const head = (paper = false) => (
    <tr className="border-b border-gray-200 text-theme-xs text-gray-500 dark:border-gray-800">
      {["N°", "Dossier", "Échéance", "Périodicité", "Responsable", "Statut", "Priorité", "Drive", ...(paper ? [] : [""])].map((h, i) => <th key={i} className="px-3 py-2 text-start font-medium">{h}</th>)}
    </tr>
  );
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Dossiers administratifs"
        subtitle="Patente, TVA, CNPS, assurances, contrats… : échéances, responsables et liens vers vos dossiers Google Drive"
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer le registre</Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit(blank())}>Nouveau dossier</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "En retard", v: s.late.length, cls: "cliva-glow bg-linear-to-br from-error-600 to-error-400 text-white" },
          { l: "Urgent (30 jours)", v: s.urgent.length, cls: "cliva-glow cliva-grad-rural text-white" },
          { l: "En cours", v: s.ongoing.length, cls: "cliva-glow cliva-grad-gestion text-white" },
          { l: "Complétés", v: s.done.length, cls: "cliva-glow cliva-grad-brand text-white" },
        ].map((k) => (
          <div key={k.l} className={cn("cliva-rise rounded-3xl p-4 shadow-cliva", k.cls)}>
            <p className="text-theme-xs text-white/85">{k.l}</p>
            <p className="text-3xl font-semibold tabular-nums">{k.v}</p>
          </div>
        ))}
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[{ key: "bord", label: "À traiter en priorité", count: priority.length }, { key: "registre", label: "Registre", count: files.length }, { key: "repertoire", label: "Répertoire Drive", count: dir.length }, { key: "echeances", label: "Obligations récurrentes", count: (db.adminObligations ?? []).length }]} />

      {tab === "bord" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_24rem]">
          <section className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">Échéance dépassée ou dans les 60 prochains jours</h3>
            <div className="custom-scrollbar overflow-x-auto"><table className="min-w-full text-sm"><thead>{head()}</thead><tbody>{priority.map((f) => row(f))}</tbody></table></div>
            {!priority.length && <p className="px-4 py-8 text-center text-sm text-gray-500">Rien d&apos;urgent.</p>}
          </section>
          <section className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">État par catégorie</h3>
            <ul className="space-y-3">
              {s.cats.map((c) => (
                <li key={c.category}>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-800 dark:text-white/90">{c.category}</span><span className="text-theme-xs text-gray-500 tabular-nums">{c.done}/{c.total}{c.late ? ` · ${c.late} en retard` : ""}</span></div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="bg-success-500" style={{ width: `${(c.done / c.total) * 100}%` }} /><div className="bg-error-500" style={{ width: `${(c.late / c.total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
            {s.withoutLink > 0 && <p className="mt-4 rounded-xl bg-warning-25 p-3 text-theme-xs text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">{s.withoutLink} dossier(s) en cours sans lien Drive : ajoutez-les pour les retrouver en un clic.</p>}
          </section>
        </div>
      )}

      {tab === "registre" && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SearchInput value={q} onChange={setQ} placeholder="Nom, catégorie, responsable…" />
            <select aria-label="Catégorie" value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 rounded-full border border-gray-200 bg-white px-4 text-sm dark:border-gray-800 dark:bg-gray-900"><option value="">Toutes les catégories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
            <select aria-label="Statut" value={st} onChange={(e) => setSt(e.target.value)} className="h-11 rounded-full border border-gray-200 bg-white px-4 text-sm dark:border-gray-800 dark:bg-gray-900"><option value="">Tous les statuts</option><option value="prio">En retard ou urgent</option>{Object.entries(ADMIN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          </div>
          <div className="custom-scrollbar overflow-x-auto rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3"><table className="min-w-full text-sm"><thead>{head()}</thead><tbody>{shown.map((f) => row(f))}</tbody></table></div>
        </section>
      )}

      {tab === "repertoire" && (
        <div className="space-y-4">
          <p className="text-theme-xs text-gray-500">Où trouver chaque dossier : emplacement dans le Drive et lien direct. Collez le lien de partage du dossier Google Drive (clic droit → Partager → Copier le lien).</p>
          {sections.map((sec) => (
            <section key={sec} className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
              <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">{sec}</h3>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {dir.filter((e) => e.section === sec).map((e) => (
                  <li key={e.id} className="grid grid-cols-1 gap-1 px-4 py-2.5 md:grid-cols-[1fr_1fr_auto] md:items-center md:gap-4">
                    <span><span className="block text-sm font-medium text-gray-800 dark:text-white/90">{e.name}</span><span className="block text-[11px] text-gray-500">{e.content} · {e.classement}</span></span>
                    <span className="text-theme-xs text-gray-600 dark:text-gray-400">📁 {e.location}</span>
                    <LinkCell id={e.id} url={e.url} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {tab === "echeances" && (
        <section className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-theme-xs text-gray-500 dark:border-gray-800">{["Mois", "Obligation", "Catégorie", "Délai légal", "Prochaine échéance", "Rappels", "Responsable", `Fait ${year}`].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(db.adminObligations ?? []).map((o) => {
                  const next = nextObligationDate(o, today);
                  const d = daysLeft(next, today);
                  const done = !!o.done?.[year];
                  return (
                    <tr key={o.id} className={cn(!done && d !== null && d <= 30 && "bg-warning-25 dark:bg-warning-500/5")}>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{o.month}</td>
                      <td className={cn("px-3 py-2 font-medium text-gray-800 dark:text-white/90", done && "text-gray-400 line-through")}>{o.label}</td>
                      <td className="px-3 py-2 text-theme-xs text-gray-600 dark:text-gray-400">{o.category}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{o.legalDeadline}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{next ? <>{formatDate(next)} <span className="text-[11px] text-gray-500">(J-{d})</span></> : "—"}</td>
                      <td className="px-3 py-2 text-[11px] text-gray-500">{next ? `J-30 : ${formatDate(addDays(next, -30))} · J-7 : ${formatDate(addDays(next, -7))}` : "—"}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{o.responsible}</td>
                      <td className="px-3 py-2"><input type="checkbox" checked={done} onChange={() => run(toggleObligation, { id: o.id, year }, { silent: true })} aria-label={`${o.label} faite en ${year}`} className="size-4 accent-brand-500" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AppModal isOpen={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.id ? "Modifier le dossier" : "Nouveau dossier"} footer={<><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Annuler</Button><Button size="sm" onClick={() => edit && run(saveAdminFile, edit).ok && setEdit(null)}>Enregistrer</Button></>}>
        {edit && (
          <FormGrid>
            <TextField label="Nom du dossier" required value={edit.name} onChange={(x) => setEdit({ ...edit, name: x })} className="sm:col-span-2" />
            <TextField label="Catégorie" value={edit.category} onChange={(x) => setEdit({ ...edit, category: x })} placeholder={cats.join(", ")} />
            <TextField label="Sous-catégorie" value={edit.subCategory ?? ""} onChange={(x) => setEdit({ ...edit, subCategory: x || undefined })} />
            <TextAreaField label="Description" value={edit.description ?? ""} onChange={(x) => setEdit({ ...edit, description: x || undefined })} rows={2} className="sm:col-span-2" />
            <TextField label="Année" value={edit.year} onChange={(x) => setEdit({ ...edit, year: x })} />
            <SelectField label="Périodicité" value={edit.periodicity} onChange={(x) => setEdit({ ...edit, periodicity: x })} options={["Annuelle", "Trimestrielle", "Mensuelle", "Selon besoin", "Unique"].map((v) => ({ value: v, label: v }))} />
            <TextField label="Date d'ouverture" type="date" value={edit.openedAt} onChange={(x) => setEdit({ ...edit, openedAt: x })} />
            <TextField label="Date d'échéance" type="date" value={edit.dueDate ?? ""} onChange={(x) => setEdit({ ...edit, dueDate: x })} />
            <TextField label="Responsable" value={edit.responsible} onChange={(x) => setEdit({ ...edit, responsible: x })} placeholder="Ex. : DG, expert-comptable" />
            <SelectField label="Statut" value={edit.status} onChange={(x) => setEdit({ ...edit, status: x as AdminFile["status"] })} options={Object.entries(ADMIN_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
            <TextField label="Lien Google Drive" value={edit.driveUrl ?? ""} onChange={(x) => setEdit({ ...edit, driveUrl: x })} placeholder="https://drive.google.com/drive/folders/…" className="sm:col-span-2" />
            <TextAreaField label="Notes / observations" value={edit.notes ?? ""} onChange={(x) => setEdit({ ...edit, notes: x || undefined })} rows={2} className="sm:col-span-2" />
          </FormGrid>
        )}
      </AppModal>

      <PrintFrame open={print} onClose={() => setPrint(false)} title="Registre des dossiers administratifs">
        <PrintHeader title="Registre des dossiers administratifs" sub={`${files.length} dossier(s) · ${s.late.length} en retard · ${s.urgent.length} urgent(s)`} />
        <table className="mt-4 w-full text-[11px]"><thead>{head(true)}</thead><tbody>{files.map((f) => row(f, true))}</tbody></table>
      </PrintFrame>
    </div>
  );
}
