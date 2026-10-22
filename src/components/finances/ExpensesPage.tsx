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
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { accountName, userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { createExpense, decideExpense } from "@/lib/services/financesService";
import type { Expense } from "@/lib/types";
import { useMemo, useState } from "react";

export default function ExpensesPage() {
  const { db, run, user, today } = useDemo();
  const opts = useOptions();
  const create = useModal();
  const isDG = user?.roleId === "dg";
  const [f, setF] = useState<Record<string, string>>({});
  const [v, setV] = useState({ accountId: "", category: "Fournitures", label: "", amount: NaN, date: today });
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
  const rows = useMemo(() => db.expenses.filter((e) => (isDG || !e.confidential) && (!f.status || e.status === f.status) && (!f.category || e.category === f.category)), [db, f, isDG]);
  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Dépenses"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={
          <Can module="finances" action="create">
            <Button size="sm" onClick={() => { setV({ accountId: opts.accounts[0]?.value ?? "", category: "Fournitures", label: "", amount: NaN, date: today }); create.openModal(); }}>
              Nouvelle dépense
            </Button>
          </Can>
        }
      />
      <DemoNotice>Délégation de dépense : {formatXOF(db.settings.expenseDelegationAmount)}. Au-delà, la dépense passe par un circuit de validation DG. {!isDG && "Les dépenses confidentielles (salaires) sont masquées pour ce profil."}</DemoNotice>
      <Panel>
        <FilterBar values={f} onChange={(k, val) => setF((s) => ({ ...s, [k]: val }))} filters={[{ key: "status", label: "Tous statuts", options: optionsOf("expense") }, { key: "category", label: "Toutes catégories", options: db.settings.expenseCategories.filter((c) => isDG || c !== "Salaires").map((c) => ({ value: c, label: c })) }]} />
        <DataTable
          rows={rows}
          rowKey={(e) => e.id}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (e) => <span className="font-medium">{e.code}</span> },
            { key: "d", header: "Date", sortValue: (e) => e.date, render: (e) => formatDate(e.date) },
            { key: "l", header: "Libellé", render: (e) => e.label },
            { key: "cat", header: "Catégorie", render: (e) => e.category },
            { key: "ac", header: "Compte", hideOnMobile: true, render: (e) => accountName(db, e.accountId) },
            { key: "a", header: "Montant", align: "end", sortValue: (e) => e.amount, render: (e) => formatXOF(e.amount) },
            {
              key: "j",
              header: "Justif.",
              align: "center",
              render: (e) =>
                e.attachmentDataUrl ? (
                  <a href={e.attachmentDataUrl} download={e.attachmentName} onClick={(ev) => ev.stopPropagation()} title={e.attachmentName} className="text-brand-600 hover:underline dark:text-brand-400">Fichier</a>
                ) : (
                  "—"
                ),
            },
            { key: "r", header: "Demandée par", hideOnMobile: true, render: (e) => userName(db, e.requestedById) },
            { key: "s", header: "Statut", render: (e) => <span className="flex flex-col gap-0.5"><StatusBadge kind="expense" value={e.status} />{!e.withinDelegation && <span className="text-[10px] text-gray-500">Hors délégation</span>}</span> },
            {
              key: "x",
              header: "Décision",
              render: (e) =>
                e.status === "en_attente" && isDG ? (
                  <span className="flex gap-1">
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
        footer={
          <>
            <Button size="sm" variant="outline" onClick={create.closeModal}>Annuler</Button>
            <Button size="sm" disabled={!v.label.trim() || !(v.amount > 0) || !v.accountId} onClick={() => { if (run(createExpense, { ...v, attachmentName: attachment?.name, attachmentDataUrl: attachment?.dataUrl }).ok) { create.closeModal(); setAttachment(null); } }}>Enregistrer</Button>
          </>
        }
      >
        <FormGrid>
          <TextField label="Libellé" required value={v.label} onChange={(label) => setV({ ...v, label })} className="sm:col-span-2" />
          <SelectField label="Catégorie" value={v.category} onChange={(category) => setV({ ...v, category })} options={db.settings.expenseCategories.filter((c) => isDG || c !== "Salaires").map((c) => ({ value: c, label: c }))} />
          <NumberField label="Montant" required suffix="FCFA" value={v.amount} onChange={(amount) => setV({ ...v, amount })} min={0} step={500} hint={v.amount > db.settings.expenseDelegationAmount ? "Hors délégation : validation DG requise" : undefined} />
          <SelectField label="Compte" required value={v.accountId} onChange={(accountId) => setV({ ...v, accountId })} options={opts.accounts} />
          <TextField label="Date" type="date" value={v.date} onChange={(date) => setV({ ...v, date })} />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Justificatif (image, scan ou PDF — optionnel)</p>
            <label className="block cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:border-brand-300 dark:border-gray-700">
              {attachment ? attachment.name : "Joindre un fichier…"}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onAttachment(e.target.files?.[0])} />
            </label>
            {attError && <p className="mt-1 text-theme-xs text-error-500">{attError}</p>}
          </div>
        </FormGrid>
      </AppModal>
      <ConfirmDialog isOpen={!!decision} onClose={() => setDecision(null)} title={decision?.approve ? "Approuver la dépense" : "Rejeter la dépense"} message={decision ? `${decision.e.code} — ${decision.e.label} (${formatXOF(decision.e.amount)})` : ""} reasonLabel="Commentaire de décision" tone={decision?.approve ? "primary" : "danger"} onConfirm={(note) => (decision ? run(decideExpense, { id: decision.e.id, approve: decision.approve, note }).ok : false)} />
    </div>
  );
}
