"use client";

import AppModal from "@/components/common/AppModal";
import DemoNotice from "@/components/common/DemoNotice";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { docTotal, invoiceCredited, lineTotal } from "@/lib/calc";
import { formatXOF, uid } from "@/lib/format";
import { createCreditNote, createInvoice, createProforma, createQuote, updateInvoiceDraft, updateQuote } from "@/lib/services/invoicesService";
import type { Invoice, InvoiceLine, Quote } from "@/lib/types";
import { useEffect, useState } from "react";
import LinesEditor from "./LinesEditor";

const newLine = (): InvoiceLine => ({ id: uid("il"), label: "", kind: "service", qty: 1, unitPrice: 0, discountPct: 0 });

/** Création / modification d'un devis ou d'une facture brouillon. */
export function DocumentEditorModal({ isOpen, onClose, kind, invoice, quote, onCreated }: { isOpen: boolean; onClose: () => void; kind: "facture" | "devis" | "proforma"; invoice?: Invoice; quote?: Quote; onCreated?: (id: string) => void }) {
  const { run } = useDemo();
  const opts = useOptions();
  const [clientId, setClientId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [dueDate, setDueDate] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    const src = invoice ?? quote;
    setClientId(src?.clientId ?? "");
    setPatientId(quote?.patientId ?? "");
    setLines(src?.lines.map((l) => ({ ...l })) ?? [newLine()]);
    setNotes(src?.notes ?? "");
    setValidDays(30);
    setDueDate(invoice?.dueDate ?? "");
  }, [isOpen, invoice, quote]);

  const save = () => {
    let r;
    if (invoice) r = run(updateInvoiceDraft, { id: invoice.id, lines, notes, dueDate });
    else if (quote) r = run(updateQuote, { id: quote.id, lines, notes });
    else if (kind === "facture") r = run(createInvoice, { clientId, lines, notes });
    else if (kind === "proforma") r = run(createProforma, { clientId, lines, notes });
    else r = run(createQuote, { clientId, patientId: patientId || undefined, lines, validDays, notes });
    if (r.ok) {
      onClose();
      if (r.data) onCreated?.(r.data as string);
    }
  };
  const editing = !!(invoice || quote);
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={editing ? `Modifier ${invoice?.code ?? quote?.code}` : kind === "facture" ? "Nouvelle facture (brouillon)" : kind === "proforma" ? "Nouveau pro forma" : "Nouveau devis"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={!clientId || !lines.length}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={3}>
          <SelectField label="Client" required value={clientId} onChange={(x) => { setClientId(x); setPatientId(""); }} options={opts.clients} disabled={editing} />
          {kind === "devis" && <SelectField label="Patient (optionnel)" value={patientId} onChange={setPatientId} options={opts.patientsOf(clientId)} allowEmpty placeholder="Aucun" disabled={editing} />}
          {kind === "devis" && !editing && <NumberField label="Validité" suffix="jours" value={validDays} onChange={setValidDays} min={1} />}
          {invoice && <TextField label="Échéance" type="date" value={dueDate} onChange={setDueDate} />}
        </FormGrid>
        <LinesEditor lines={lines} onChange={setLines} />
        <TextAreaField label="Notes" value={notes} onChange={setNotes} rows={2} />
      </div>
    </AppModal>
  );
}

/** Avoir lié à la facture d'origine : sélection des lignes à créditer + motif obligatoire. */
export function CreditNoteModal({ invoice, onClose, onCreated }: { invoice: Invoice | null; onClose: () => void; onCreated?: (id: string) => void }) {
  const { run, db } = useDemo();
  const [sel, setSel] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (invoice) {
      setSel({});
      setReason("");
    }
  }, [invoice]);
  if (!invoice) return null;
  const lines = invoice.lines.filter((l) => sel[l.id] > 0).map((l) => ({ ...l, id: uid("il"), qty: sel[l.id], label: `Avoir : ${l.label}` }));
  const max = docTotal(invoice.lines) - invoiceCredited(db, invoice.id);
  return (
    <AppModal
      isOpen={!!invoice}
      onClose={onClose}
      size="lg"
      title={`Émettre un avoir sur ${invoice.code}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={!lines.length || !reason.trim()}
            onClick={() => {
              const r = run(createCreditNote, { invoiceId: invoice.id, lines, reason });
              if (r.ok) {
                onClose();
                if (r.data) onCreated?.(r.data);
              }
            }}
          >
            Émettre l&apos;avoir ({formatXOF(docTotal(lines))})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DemoNotice>Une facture validée n&apos;est jamais modifiée silencieusement : l&apos;avoir est un document correctif lié à l&apos;original, qui reste consultable. Montant créditable restant : {formatXOF(max)}.</DemoNotice>
        <ul className="space-y-2">
          {invoice.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[1fr_6rem_7rem] items-center gap-2 text-sm">
              <span>
                {l.label} <span className="text-theme-xs text-gray-500">({l.qty} × {formatXOF(lineTotal({ ...l, qty: 1 }))})</span>
              </span>
              <NumberField label="" value={sel[l.id] ?? 0} onChange={(x) => setSel({ ...sel, [l.id]: Math.min(Math.max(0, x || 0), l.qty) })} min={0} max={l.qty} />
              <span className="text-end">{formatXOF(lineTotal({ ...l, qty: sel[l.id] ?? 0 }))}</span>
            </li>
          ))}
        </ul>
        <TextAreaField label="Motif de correction" required value={reason} onChange={setReason} rows={2} />
      </div>
    </AppModal>
  );
}
