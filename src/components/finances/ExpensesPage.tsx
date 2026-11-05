"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { activeLines } from "@/lib/budgets";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { accountName, userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createExpense, decideExpense } from "@/lib/services/financesService";
import { setExpenseProject } from "@/lib/services/projectsService";
import type { Expense } from "@/lib/types";
import { proofCount } from "@/lib/projects";
import ProjectModal, { EMPTY_PROJECT } from "@/components/projects/ProjectModal";
import type { ProjectInput } from "@/lib/services/projectsService";
import { useQueryParam } from "@/hooks/useQueryFlag";
import ExpenseDetailModal from "./ExpenseDetailModal";
import { LinkAdder, LinkList, PhotoButtons, PhotoStrip, useProofInputs, type DraftLink, type DraftPhoto } from "./ProofPicker";
import { useMemo, useState } from "react";

export default function ExpensesPage() {
  const { db, run, user, today } = useDemo();
  const opts = useOptions();
  const create = useModal();
  const isDG = user?.roleId === "dg";
  const [f, setF] = useState<Record<string, string>>({});
  const projectParam = useQueryParam("projet") ?? "";
  const [v, setV] = useState({ accountId: "", category: "Fournitures", detail: "", budgetLineId: "", projectId: "", label: "", amount: NaN, date: today });
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const proof = useProofInputs((ph) => setPhotos((s) => (s.length >= 6 ? s : [...s, ph])));
  const [detail, setDetail] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectInput | null>(null);
  const openProjects = (db.projects ?? []).filter((p) => p.status !== "termine");
  const [attachment, setAttachment] = useState<{ name: string; dataUrl: string } | null>(null);
  const [attError, setAttError] = useState("");
  const onAttachment = (f?: File) => {
    setAttError("");
    setAttachment(null);
    if (!f) return;
    if (f.size > 800 * 1024) return setAttError("Justificatif trop volumineux : 800 Ko maximum en démonstration.");
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: f.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };
  const [decision, setDecision] = useState<{ e: Expense; approve: boolean } | null>(null);
  const pf = f.project ?? projectParam;
  const rows = useMemo(
    () =>
      db.expenses.filter(
        (e) =>
          (isDG || !e.confidential) &&
          (!f.status || e.status === f.status) &&
          (!f.category || e.category === f.category) &&
          (!pf || (pf === "aucun" ? !e.projectId : e.projectId === pf)) &&
          (!f.proof || (f.proof === "sans" ? proofCount(e) === 0 : proofCount(e) > 0)),
      ),
    [db, f, isDG, pf],
  );
  const noProof = db.expenses.filter((e) => (isDG || !e.confidential) && e.status !== "rejetee" && proofCount(e) === 0).length;
  const reset = () => {
    setV({ accountId: opts.accounts[0]?.value ?? "", category: "Fournitures", detail: "", budgetLineId: "", projectId: pf && pf !== "aucun" ? pf : "", label: "", amount: NaN, date: today });
    setLinks([]);
    setPhotos([]);
    setAttachment(null);
  };
  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Dépenses"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={
          <Can module="finances" action="create">
            <Button size="sm" onClick={() => { reset(); create.openModal(); }}>
              Nouvelle dépense
            </Button>
          </Can>
        }
      />
      {noProof > 0 && (
        <button type="button" onClick={() => setF((s) => ({ ...s, proof: "sans" }))} className="w-full rounded-2xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-start text-theme-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
          <strong>{noProof} dépense(s) sans preuve</strong> : ouvrez-les pour photographier la facture ou coller le lien Drive. Cliquez pour les afficher.
        </button>
      )}
      <DemoNotice>Délégation de dépense : {formatXOF(db.settings.expenseDelegationAmount)}. Au-delà, la dépense passe par un circuit de validation DG. {!isDG && "Les dépenses confidentielles (salaires) sont masquées pour ce profil."}</DemoNotice>
      <Panel>
        <FilterBar values={{ ...f, project: pf }} onChange={(k, val) => setF((s) => ({ ...s, [k]: val }))} filters={[{ key: "status", label: "Tous statuts", options: optionsOf("expense") }, { key: "category", label: "Toutes catégories", options: db.settings.expenseCategories.filter((c) => isDG || c !== "Salaires").map((c) => ({ value: c, label: c })) }, { key: "project", label: "Tous les projets", options: [{ value: "aucun", label: "Sans projet" }, ...(db.projects ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))] }, { key: "proof", label: "Preuves : toutes", options: [{ value: "sans", label: "Sans preuve" }, { value: "avec", label: "Avec preuve" }] }]} />
        <DataTable
          rows={rows}
          rowKey={(e) => e.id}
          onRowClick={(e) => setDetail(e.id)}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (e) => <span className="font-medium">{e.code}</span> },
            { key: "d", header: "Date", sortValue: (e) => e.date, render: (e) => formatDate(e.date) },
            { key: "l", header: "Libellé", render: (e) => e.label },
            { key: "cat", header: "Catégorie", render: (e) => (e.detail ? `${e.category} · ${e.detail}` : e.category) },
            { key: "p", header: "Projet", hideOnMobile: true, render: (e) => { const p = (db.projects ?? []).find((x) => x.id === e.projectId); return p ? <span title={p.name} className="inline-block max-w-40 truncate rounded-full bg-theme-purple-500/10 px-2 py-0.5 align-middle text-theme-xs font-medium whitespace-nowrap text-theme-purple-500">{p.name}</span> : <span className="text-gray-400">—</span>; } },
            { key: "ac", header: "Compte", hideOnMobile: true, render: (e) => accountName(db, e.accountId) },
            { key: "a", header: "Montant", align: "end", sortValue: (e) => e.amount, render: (e) => formatXOF(e.amount) },
            {
              key: "j",
              header: "Preuves",
              align: "center",
              sortValue: (e) => proofCount(e),
              render: (e) => {
                const n = proofCount(e);
                return n ? (
                  <span className="inline-flex items-center gap-1 text-theme-xs text-success-700 dark:text-success-400" title={`${e.photos?.length ?? 0} photo(s), ${e.proofLinks?.length ?? 0} lien(s)${e.attachmentDataUrl ? ", 1 fichier" : ""}`}>
                    ✓ {n}
                  </span>
                ) : (
                  <span className="text-theme-xs font-medium text-warning-600">À fournir</span>
                );
              },
            },
            { key: "r", header: "Demandée par", hideOnMobile: true, render: (e) => userName(db, e.requestedById) },
            { key: "s", header: "Statut", render: (e) => <span className="flex flex-col gap-0.5"><StatusBadge kind="expense" value={e.status} />{!e.withinDelegation && <span className="text-[10px] text-gray-500">Hors délégation</span>}</span> },
            {
              key: "x",
              header: "Décision",
              render: (e) =>
                e.status === "en_attente" && isDG ? (
                  <span className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                    <Button size="xs" onClick={() => setDecision({ e, approve: true })}>Approuver</Button>
                    <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setDecision({ e, approve: false })}>Rejeter</Button>
                  </span>
                ) : e.decidedById ? (
                  <span className="text-theme-xs text-gray-500">{userName(db, e.decidedById)}</span>
                ) : null,
            },
          ]}
          emptyTitle="Aucune dépense"
        />
      </Panel>
      <AppModal
        isOpen={create.isOpen}
        onClose={create.closeModal}
        title="Nouvelle dépense"
        size="lg"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={create.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!v.label.trim() || !(v.amount > 0) || !v.accountId} onClick={() => { if (run(createExpense, { ...v, projectId: v.projectId || undefined, attachmentName: attachment?.name, attachmentDataUrl: attachment?.dataUrl, proofLinks: links, photos }).ok) { create.closeModal(); reset(); } }}>Enregistrer</Button>
          </>
        }
      >
        <FormGrid>
          <TextField label="Libellé" required value={v.label} onChange={(label) => setV({ ...v, label })} className="sm:col-span-2" />
          <SelectField label="Catégorie" value={v.category} onChange={(category) => setV({ ...v, category, detail: "" })} options={db.settings.expenseCategories.filter((c) => isDG || c !== "Salaires").map((c) => ({ value: c, label: c }))} />
          {(db.settings.expenseDetails?.[v.category]?.length ?? 0) > 0 && <SelectField label="Précision" value={v.detail} onChange={(detail) => setV({ ...v, detail })} options={(db.settings.expenseDetails?.[v.category] ?? []).map((d) => ({ value: d, label: d }))} allowEmpty placeholder="—" />}
          <SelectField label="Ligne de budget" value={v.budgetLineId} onChange={(budgetLineId) => setV({ ...v, budgetLineId })} options={activeLines(db, v.date || today).map((x) => ({ value: x.line.id, label: `${x.line.label} — reste ${formatXOF(x.left)}` }))} allowEmpty placeholder="Hors budget (validation DG)" />
          <NumberField label="Montant" required suffix="FCFA" value={v.amount} onChange={(amount) => setV({ ...v, amount })} min={0} step={500} hint={v.amount > db.settings.expenseDelegationAmount ? "Hors délégation : validation DG requise" : undefined} />
          <SelectField label="Compte" required value={v.accountId} onChange={(accountId) => setV({ ...v, accountId })} options={opts.accounts} />
          <TextField label="Date" type="date" value={v.date} onChange={(date) => setV({ ...v, date })} />
          <div className="sm:col-span-2">
            <SelectField label="Projet (facultatif)" value={v.projectId} onChange={(projectId) => setV({ ...v, projectId })} options={openProjects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} allowEmpty placeholder="Aucun projet" />
            <button type="button" className="mt-1 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setProject({ ...EMPTY_PROJECT })}>+ Créer un projet</button>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Photos de la facture / du reçu</p>
            <PhotoButtons onFiles={proof.onFiles} busy={proof.busy} disabled={photos.length >= 6} />
            {proof.err && <p className="text-theme-xs text-error-500">{proof.err}</p>}
            <PhotoStrip photos={photos} onRemove={(i) => setPhotos((s) => s.filter((_, k) => k !== i))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-400">Liens Drive de preuve</p>
            <LinkList links={links} onRemove={(i) => setLinks((s) => s.filter((_, k) => k !== i))} />
            <LinkAdder onAdd={(l) => setLinks((s) => [...s, l])} />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Autre justificatif (PDF ou scan — optionnel)</p>
            <label className="block cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:border-brand-300 dark:border-gray-700">
              {attachment ? attachment.name : "Joindre un fichier…"}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onAttachment(e.target.files?.[0])} />
            </label>
            {attError && <p className="mt-1 text-theme-xs text-error-500">{attError}</p>}
          </div>
        </FormGrid>
      </AppModal>
      <ExpenseDetailModal id={detail} onClose={() => setDetail(null)} onNewProject={() => setProject({ ...EMPTY_PROJECT })} />
      <ProjectModal
        value={project}
        onClose={() => setProject(null)}
        onSaved={(pid) => {
          if (detail) run(setExpenseProject, { id: detail, projectId: pid }, { silent: true });
          else setV((s) => ({ ...s, projectId: pid }));
        }}
      />
      <ConfirmDialog isOpen={!!decision} onClose={() => setDecision(null)} title={decision?.approve ? "Approuver la dépense" : "Rejeter la dépense"} message={decision ? `${decision.e.code} — ${decision.e.label} (${formatXOF(decision.e.amount)})` : ""} reasonLabel="Commentaire de décision" tone={decision?.approve ? "primary" : "danger"} onConfirm={(note) => (decision ? run(decideExpense, { id: decision.e.id, approve: decision.approve, note }).ok : false)} />
    </div>
  );
}
