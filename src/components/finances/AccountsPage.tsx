"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { accountBalance, accountName, clientName, userName } from "@/lib/calc";
import { formatDate, formatXOF } from "@/lib/format";
import { closeCash, createAccountTransfer, setOpeningBalance } from "@/lib/services/financesService";
import { cn } from "@/utils";
import { useMemo, useState } from "react";

type Modal = null | "transfer" | "closing" | "opening";

export default function AccountsPage() {
  const { db, run, user, can, today } = useDemo();
  const opts = useOptions();
  const isDG = user?.roleId === "dg";
  const [selected, setSelected] = useState(db.accounts[0]?.id ?? "");
  const [modal, setModal] = useState<Modal>(null);
  const [tr, setTr] = useState({ fromAccountId: "", toAccountId: "", amount: NaN, fees: 0, note: "" });
  const [cl, setCl] = useState({ accountId: "", counted: NaN, note: "" });
  const [op, setOp] = useState({ accountId: "", amount: NaN, date: "" });

  const history = useMemo(() => {
    const acc = db.accounts.find((a) => a.id === selected);
    if (!acc) return [];
    const rows: { id: string; date: string; label: string; amount: number; kind: string }[] = [{ id: "open", date: acc.openingDate, label: "Solde d'ouverture", amount: acc.openingBalance, kind: "Ouverture" }];
    db.payments.filter((p) => p.accountId === selected).forEach((p) => rows.push({ id: p.id, date: p.date, label: `${p.code} — ${clientName(db, p.clientId)}`, amount: p.amount, kind: "Encaissement" }));
    db.expenses.filter((e) => e.accountId === selected && e.status === "approuvee" && (isDG || !e.confidential)).forEach((e) => rows.push({ id: e.id, date: e.date, label: `${e.code} — ${e.label}`, amount: -e.amount, kind: "Dépense" }));
    db.accountTransfers.forEach((t) => {
      if (t.fromAccountId === selected) rows.push({ id: `${t.id}-o`, date: t.date, label: `${t.code} vers ${accountName(db, t.toAccountId)}${t.fees ? ` (frais ${formatXOF(t.fees)})` : ""}`, amount: -(t.amount + t.fees), kind: "Transfert" });
      if (t.toAccountId === selected) rows.push({ id: `${t.id}-i`, date: t.date, label: `${t.code} depuis ${accountName(db, t.fromAccountId)}`, amount: t.amount, kind: "Transfert" });
    });
    return rows;
  }, [db, selected, isDG]);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Comptes, caisse et transferts"
        trail={[{ label: "Finances", href: "/finances" }]}
        actions={
          <>
            {can("finances", "create") && (
              <Button size="sm" variant="outline" onClick={() => { setCl({ accountId: db.accounts.find((a) => a.type === "caisse")?.id ?? "", counted: NaN, note: "" }); setModal("closing"); }}>
                Clôture de caisse
              </Button>
            )}
            {isDG && (
              <>
                <Button size="sm" variant="outline" onClick={() => { setOp({ accountId: selected, amount: db.accounts.find((a) => a.id === selected)?.openingBalance ?? 0, date: db.accounts.find((a) => a.id === selected)?.openingDate ?? today }); setModal("opening"); }}>
                  Solde d&apos;ouverture
                </Button>
                <Button size="sm" onClick={() => { setTr({ fromAccountId: "", toAccountId: "", amount: NaN, fees: 0, note: "" }); setModal("transfer"); }}>
                  Transfert entre comptes
                </Button>
              </>
            )}
          </>
        }
      />
      <DemoNotice>Banques et Mobile Money sont simulés. Un transfert entre comptes n&apos;est ni une recette ni une dépense pour son montant principal (seuls d&apos;éventuels frais réduisent la trésorerie).</DemoNotice>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {db.accounts.map((a) => (
          <button key={a.id} onClick={() => setSelected(a.id)} className={cn("rounded-2xl border bg-white p-4 text-start transition dark:bg-white/3", selected === a.id ? "border-brand-400 ring-2 ring-brand-500/20" : "border-gray-200 hover:border-brand-200 dark:border-gray-800")}>
            <StatusBadge kind="account" value={a.type} />
            <p className="mt-2 truncate text-sm text-gray-600 dark:text-gray-400">{a.name}</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{formatXOF(accountBalance(db, a.id))}</p>
          </button>
        ))}
      </div>
      <ComponentCard title={`Historique — ${accountName(db, selected)}`}>
        <DataTable
          rows={history}
          rowKey={(r) => r.id}
          initialSort={{ key: "d", dir: "desc" }}
          columns={[
            { key: "d", header: "Date", primary: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
            { key: "k", header: "Type", render: (r) => r.kind },
            { key: "l", header: "Libellé", render: (r) => r.label },
            { key: "a", header: "Montant", align: "end", sortValue: (r) => r.amount, render: (r) => <span className={r.amount >= 0 ? "text-success-600" : "text-error-600"}>{r.amount >= 0 ? "+" : ""}{formatXOF(r.amount)}</span> },
          ]}
        />
      </ComponentCard>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <ComponentCard title="Transferts entre comptes">
          <DataTable rows={db.accountTransfers} rowKey={(t) => t.id} pageSize={5} columns={[{ key: "c", header: "Réf.", primary: true, render: (t) => t.code }, { key: "d", header: "Date", render: (t) => formatDate(t.date) }, { key: "w", header: "De → vers", render: (t) => `${accountName(db, t.fromAccountId)} → ${accountName(db, t.toAccountId)}` }, { key: "a", header: "Montant", align: "end", render: (t) => formatXOF(t.amount) }]} emptyTitle="Aucun transfert" />
        </ComponentCard>
        <ComponentCard title="Clôtures de caisse">
          <DataTable rows={db.closings} rowKey={(c) => c.id} pageSize={5} columns={[{ key: "d", header: "Date", primary: true, render: (c) => formatDate(c.date) }, { key: "a", header: "Caisse", render: (c) => accountName(db, c.accountId) }, { key: "e", header: "Attendu / compté", render: (c) => `${formatXOF(c.expected)} / ${formatXOF(c.counted)}` }, { key: "g", header: "Écart", align: "end", render: (c) => <span className={c.counted - c.expected ? "font-medium text-error-600" : "text-success-600"}>{formatXOF(c.counted - c.expected)}</span> }, { key: "u", header: "Par", render: (c) => userName(db, c.userId) }]} emptyTitle="Aucune clôture" />
        </ComponentCard>
      </div>

      <AppModal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === "transfer" ? "Transfert entre comptes (simulé)" : modal === "closing" ? "Clôture de caisse" : "Solde d'ouverture"}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button
              size="sm"
              onClick={() => {
                const r = modal === "transfer" ? run(createAccountTransfer, tr) : modal === "closing" ? run(closeCash, cl) : run(setOpeningBalance, op);
                if (r.ok) setModal(null);
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        {modal === "transfer" && (
          <FormGrid>
            <SelectField label="Compte source" value={tr.fromAccountId} onChange={(x) => setTr({ ...tr, fromAccountId: x })} options={opts.accounts} />
            <SelectField label="Compte destination" value={tr.toAccountId} onChange={(x) => setTr({ ...tr, toAccountId: x })} options={opts.accounts.filter((a) => a.value !== tr.fromAccountId)} />
            <NumberField label="Montant" suffix="FCFA" value={tr.amount} onChange={(x) => setTr({ ...tr, amount: x })} min={0} />
            <NumberField label="Frais" suffix="FCFA" value={tr.fees} onChange={(x) => setTr({ ...tr, fees: x || 0 })} min={0} />
            <TextField label="Note" value={tr.note} onChange={(x) => setTr({ ...tr, note: x })} className="sm:col-span-2" />
          </FormGrid>
        )}
        {modal === "closing" && (
          <div className="space-y-4">
            <SelectField label="Caisse" value={cl.accountId} onChange={(x) => setCl({ ...cl, accountId: x })} options={db.accounts.filter((a) => a.type === "caisse").map((a) => ({ value: a.id, label: a.name }))} />
            {cl.accountId && <p className="text-sm text-gray-600 dark:text-gray-400">Solde théorique : <strong>{formatXOF(accountBalance(db, cl.accountId))}</strong></p>}
            <NumberField label="Montant compté" suffix="FCFA" value={cl.counted} onChange={(x) => setCl({ ...cl, counted: x })} min={0} />
            <TextField label="Justification de l'écart (si écart)" value={cl.note} onChange={(x) => setCl({ ...cl, note: x })} />
          </div>
        )}
        {modal === "opening" && (
          <FormGrid>
            <SelectField label="Compte" value={op.accountId} onChange={(x) => setOp({ ...op, accountId: x })} options={opts.accounts} />
            <NumberField label="Solde d'ouverture" suffix="FCFA" value={op.amount} onChange={(x) => setOp({ ...op, amount: x })} />
            <TextField label="Date d'ouverture" type="date" value={op.date} onChange={(x) => setOp({ ...op, date: x })} />
          </FormGrid>
        )}
      </AppModal>
    </div>
  );
}
