"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, NumberField, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { invoiceBalance, isActiveInvoice, receivablePaid } from "@/lib/calc";
import { formatXOF, uid } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { recordPayment } from "@/lib/services/paymentsService";
import type { Payment, PaymentMethod } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  invoiceId?: string;
  defaultAmount?: number;
  defaultKind?: Payment["kind"];
  title?: string;
  onDone?: (paymentId: string) => void;
}

/** Encaissement simulé (espèces, Mobile Money, carte, virement, chèque) — aucun mouvement d'argent réel. */
export default function PaymentModal({ isOpen, onClose, clientId, invoiceId, defaultAmount, defaultKind = "reglement", title = "Enregistrer un encaissement", onDone }: Props) {
  const { db, run, establishment } = useDemo();
  const opts = useOptions();
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState(NaN);
  const [method, setMethod] = useState<PaymentMethod>("especes");
  const [account, setAccount] = useState("");
  const [kind, setKind] = useState<Payment["kind"]>("reglement");
  const [target, setTarget] = useState("");
  const [reference, setReference] = useState("");
  const [opKey, setOpKey] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const inv = invoiceId ? db.invoices.find((i) => i.id === invoiceId) : undefined;
    setClient(clientId ?? inv?.clientId ?? "");
    setAmount(defaultAmount ?? (inv ? invoiceBalance(db, inv) : NaN));
    setMethod("especes");
    setKind(defaultKind);
    setTarget(invoiceId ? `inv:${invoiceId}` : "");
    setReference("");
    setOpKey(uid("pay-op")); // clé d'idempotence : un double clic n'enregistre qu'un seul paiement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const accounts = useMemo(() => db.accounts.filter((a) => (method === "especes" ? a.type === "caisse" : method === "mobile_money" ? a.type === "mobile_money" : a.type === "banque")), [db.accounts, method]);
  useEffect(() => {
    setAccount(accounts.find((a) => a.establishmentId === establishment?.id)?.id ?? accounts[0]?.id ?? "");
  }, [accounts, establishment]);

  const targets = useMemo(() => {
    if (!client) return [];
    const invs = db.invoices.filter((i) => i.clientId === client && i.kind === "facture" && isActiveInvoice(i) && invoiceBalance(db, i) > 0).map((i) => ({ value: `inv:${i.id}`, label: `${i.code} — solde ${formatXOF(invoiceBalance(db, i))}` }));
    const recs = db.openingReceivables.filter((r) => r.clientId === client && r.amount - receivablePaid(db, r.id) > 0).map((r) => ({ value: `rec:${r.id}`, label: `${r.code} (créance antérieure) — reste ${formatXOF(r.amount - receivablePaid(db, r.id))}` }));
    return [...invs, ...recs];
  }, [db, client]);

  const targetBalance = (() => {
    if (target.startsWith("inv:")) {
      const i = db.invoices.find((x) => x.id === target.slice(4));
      return i ? invoiceBalance(db, i) : 0;
    }
    if (target.startsWith("rec:")) {
      const r = db.openingReceivables.find((x) => x.id === target.slice(4));
      return r ? r.amount - receivablePaid(db, r.id) : 0;
    }
    return 0;
  })();
  const allocated = target ? Math.min(amount || 0, targetBalance) : 0;
  const over = (amount || 0) - allocated;

  const save = () => {
    const allocations = !target || allocated <= 0 ? [] : target.startsWith("inv:") ? [{ invoiceId: target.slice(4), amount: allocated }] : [{ receivableId: target.slice(4), amount: allocated }];
    const r = run(recordPayment, {
      clientId: client,
      amount,
      method,
      accountId: account,
      kind: target.startsWith("rec:") ? "ancienne_creance" : target ? kind : "acompte",
      allocations,
      reference,
      note: "",
      opKey,
    });
    if (r.ok) {
      onClose();
      if (r.data) onDone?.(r.data);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={!client || !(amount > 0) || !account}>
            Encaisser (simulation)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice>Paiement enregistré localement à titre de démonstration. Aucun débit Mobile Money, carte ou virement n&apos;est effectué.</DemoNotice>
        <FormGrid>
          <SelectField label="Client" required value={client} onChange={(x) => { setClient(x); setTarget(""); }} options={opts.clients} disabled={!!clientId || !!invoiceId} />
          <NumberField label="Montant" required suffix="FCFA" value={amount} onChange={setAmount} min={0} step={100} />
          <SelectField label="Moyen de paiement" value={method} onChange={(x) => setMethod(x as PaymentMethod)} options={optionsOf("paymentMethod")} />
          <SelectField label="Compte d'encaissement" required value={account} onChange={setAccount} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          <SelectField label="Affectation" value={target} onChange={setTarget} options={targets} allowEmpty placeholder="Aucune (acompte / avance)" disabled={!!invoiceId} />
          {target.startsWith("inv:") && <SelectField label="Nature" value={kind} onChange={(x) => setKind(x as Payment["kind"])} options={[{ value: "reglement", label: "Règlement" }, { value: "acompte", label: "Acompte" }]} />}
          {method !== "especes" && <TextField label="Référence de transaction (fictive)" value={reference} onChange={setReference} />}
        </FormGrid>
        {amount > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Affecté : <strong>{formatXOF(allocated)}</strong>
            {over > 0 && (
              <>
                {" "}
                · non affecté (acompte / trop-perçu au crédit du client) : <strong>{formatXOF(over)}</strong>
              </>
            )}
            {target.startsWith("rec:") && " · Créance antérieure : la date réelle du paiement (aujourd'hui) est conservée."}
          </p>
        )}
      </div>
    </AppModal>
  );
}
