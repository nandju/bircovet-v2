"use client";

import AppModal from "@/components/common/AppModal";
import StatusBadge from "@/components/common/StatusBadge";
import { SelectField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { accountName, userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { addExpenseProof, removeExpenseProof, setExpenseProject } from "@/lib/services/projectsService";
import { LinkAdder, LinkList, PhotoButtons, PhotoStrip, useProofInputs } from "./ProofPicker";

/** Fiche d'une dépense : preuves (photos, liens Drive, fichier) et projet, modifiables après coup. */
export default function ExpenseDetailModal({ id, onClose, onNewProject }: { id: string | null; onClose: () => void; onNewProject: () => void }) {
  const { db, run, can } = useDemo();
  const e = id ? db.expenses.find((x) => x.id === id) : undefined;
  const { busy, err, onFiles } = useProofInputs((photo) => e && run(addExpenseProof, { id: e.id, photo }));
  if (!e) return null;
  const edit = can("finances", "create");
  const projects = (db.projects ?? []).filter((p) => p.status !== "termine" || p.id === e.projectId);
  const photos = e.photos ?? [];
  const links = e.proofLinks ?? [];
  const nothing = !photos.length && !links.length && !e.attachmentDataUrl;
  return (
    <AppModal isOpen onClose={onClose} size="lg" title={`${e.code} — ${e.label}`} description={`${formatDate(e.date)} · ${e.detail ? `${e.category} · ${e.detail}` : e.category} · ${accountName(db, e.accountId)} · saisie par ${userName(db, e.requestedById)}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/5">
          <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatXOF(e.amount)}</p>
          <StatusBadge kind="expense" value={e.status} />
        </div>

        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Projet</h4>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <SelectField label="Rattacher à un projet" value={e.projectId ?? ""} onChange={(x) => run(setExpenseProject, { id: e.id, projectId: x || undefined })} options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} allowEmpty placeholder="Aucun projet" disabled={!edit} />
            </div>
            {edit && <Button size="sm" variant="ghost" onClick={onNewProject}>Nouveau projet</Button>}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Preuves</h4>
          {nothing && <p className="rounded-xl bg-warning-50 px-3 py-2 text-theme-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">Aucune preuve : photographiez la facture ou collez le lien Drive.</p>}
          {e.attachmentDataUrl && (
            <p className="text-sm">
              Fichier joint : <a href={e.attachmentDataUrl} download={e.attachmentName} className="text-brand-600 hover:underline dark:text-brand-400">{e.attachmentName ?? "justificatif"}</a>
            </p>
          )}
          <PhotoStrip photos={photos} onRemove={edit ? (i) => run(removeExpenseProof, { id: e.id, proofId: photos[i].id }) : undefined} />
          <LinkList links={links} onRemove={edit ? (i) => run(removeExpenseProof, { id: e.id, proofId: links[i].id }) : undefined} />
          {edit && (
            <div className="space-y-3 rounded-2xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
              <PhotoButtons onFiles={onFiles} busy={busy} disabled={photos.length >= 6} />
              {err && <p className="text-theme-xs text-error-500">{err}</p>}
              <LinkAdder onAdd={(link) => run(addExpenseProof, { id: e.id, link })} />
            </div>
          )}
        </section>
      </div>
    </AppModal>
  );
}
