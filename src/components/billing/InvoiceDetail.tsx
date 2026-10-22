"use client";

import ComponentCard from "@/components/common/ComponentCard";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import PaymentModal from "@/components/finances/PaymentModal";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link, useRouter } from "@/i18n/navigation";
import { PrinterIcon } from "@/icons";
import { clientName, docTotal, invoiceBalance, invoiceCredited, invoicePaid, isActiveInvoice, maxDiscount, userName } from "@/lib/calc";
import { formatDate, formatDateTime, formatXOF } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { cancelInvoice, convertProforma, setFneStatus, submitInvoice, validateInvoice } from "@/lib/services/invoicesService";
import { printPage } from "@/utils/export";
import { useState } from "react";
import BillingDocument from "./BillingDocument";
import { CreditNoteModal, DocumentEditorModal } from "./BillingModals";

export default function InvoiceDetail({ id }: { id: string }) {
  const { db, run, can, user } = useDemo();
  const router = useRouter();
  const edit = useModal();
  const pay = useModal();
  const cancel = useModal();
  const [credit, setCredit] = useState(false);
  const inv = db.invoices.find((i) => i.id === id);
  if (!inv) return <p className="text-sm text-gray-500">Document introuvable.</p>;
  const isAvoir = inv.kind === "avoir";
  const isProforma = inv.kind === "proforma";
  const converted = isProforma ? db.invoices.find((i) => i.id === inv.convertedToInvoiceId) : undefined;
  const draft = inv.status === "brouillon" || inv.status === "a_valider";
  const payments = db.payments.filter((p) => p.allocations.some((a) => a.invoiceId === inv.id));
  const credits = db.invoices.filter((i) => i.originalInvoiceId === inv.id);
  const original = db.invoices.find((i) => i.id === inv.originalInvoiceId);
  const total = docTotal(inv.lines);
  const discountOver = maxDiscount(inv.lines) > db.settings.discountDelegationPct;
  const canBill = can("facturation", "create");
  const canValidate = user?.roleId === "dg" || user?.roleId === "accueil";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={`${isAvoir ? "Avoir" : isProforma ? "Pro forma" : "Facture"} ${inv.code}`}
        subtitle={`${clientName(db, inv.clientId)} · ${isProforma ? "Document non engageant" : labelOf("invoice", inv.status)}`}
        trail={[{ label: isAvoir ? "Avoirs" : isProforma ? "Pro forma" : "Factures", href: isAvoir ? "/facturation/avoirs" : isProforma ? "/facturation/proforma" : "/facturation" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={printPage}>
              Imprimer / PDF
            </Button>
            {isProforma && !converted && canValidate && (
              <Button size="sm" onClick={() => { const r = run(convertProforma, { id: inv.id }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>
                Convertir en facture
              </Button>
            )}
            {!isProforma && draft && canBill && (
              <Button size="sm" variant="outline" onClick={edit.openModal}>
                Modifier le brouillon
              </Button>
            )}
            {inv.status === "brouillon" && canBill && (
              <Button size="sm" variant="secondary" onClick={() => run(submitInvoice, { id: inv.id })}>
                Soumettre
              </Button>
            )}
            {draft && canValidate && (
              <Button size="sm" onClick={() => run(validateInvoice, { id: inv.id })}>
                Valider
              </Button>
            )}
            {draft && canBill && (
              <Button size="sm" variant="ghost" className="text-error-600" onClick={cancel.openModal}>
                Annuler le brouillon
              </Button>
            )}
            {!isAvoir && !isProforma && isActiveInvoice(inv) && invoiceBalance(db, inv) > 0 && can("finances", "create") && (
              <Button size="sm" onClick={pay.openModal}>
                Enregistrer un paiement
              </Button>
            )}
            {!isAvoir && !isProforma && isActiveInvoice(inv) && canValidate && (
              <Button size="sm" variant="outline" onClick={() => setCredit(true)}>
                Corriger par avoir
              </Button>
            )}
          </>
        }
      />
      {discountOver && draft && <DemoNotice tone="warning">Remise hors délégation ({maxDiscount(inv.lines)} % &gt; {db.settings.discountDelegationPct} %) : seule une validation par le profil DG est possible.</DemoNotice>}
      {!draft && !isAvoir && !isProforma && <DemoNotice>Facture validée : elle ne peut plus être modifiée. Toute correction passe par un avoir lié, avec motif.</DemoNotice>}
      {isProforma && <DemoNotice>Pro forma : document commercial non engageant, hors solde et hors recettes. La conversion crée une facture brouillon distincte.</DemoNotice>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="xl:col-span-2">
          <BillingDocument
            title={isAvoir ? "Avoir" : isProforma ? "Facture pro forma" : "Facture"}
            code={inv.code}
            date={inv.date}
            secondDate={isAvoir ? undefined : { label: "Échéance", value: inv.dueDate }}
            clientName={clientName(db, inv.clientId)}
            payerName={inv.payerName}
            lines={inv.lines}
            notes={[inv.notes, isAvoir && original ? `Avoir lié à la facture ${original.code}. Motif : ${inv.correctionReason}` : ""].filter(Boolean).join(" — ")}
            footerRows={
              isAvoir || isProforma
                ? []
                : [
                    { label: "Payé", value: formatXOF(invoicePaid(db, inv.id)) },
                    ...(invoiceCredited(db, inv.id) ? [{ label: "Avoirs", value: `− ${formatXOF(invoiceCredited(db, inv.id))}` }] : []),
                    { label: "Solde", value: formatXOF(invoiceBalance(db, inv)), strong: true },
                  ]
            }
          />
        </div>
        <div className="space-y-4 print:hidden">
          <ComponentCard title="Suivi">
            <InfoGrid
              items={[
                { label: "Statut", value: <StatusBadge kind="invoice" value={inv.status} /> },
                { label: "Total", value: formatXOF(total) },
                { label: "Auteur", value: userName(db, inv.authorId) },
                { label: "Validation", value: inv.validatedById ? `${userName(db, inv.validatedById)} — ${formatDateTime(inv.validatedAt)}` : "—" },
                { label: "Intégration fiscale", value: inv.fiscalStatus === "a_transmettre_backend" ? "À transmettre (après intégration backend)" : "Non concerné (démo)", wide: true },
                ...(inv.kind === "facture" ? [{ label: "Distinction FNE", value: <StatusBadge kind="fne" value={inv.fneStatus ?? "non_renseigne"} /> }] : []),
                ...(converted ? [{ label: "Convertie en", value: converted.code }] : []),
              ]}
            />
            {original && (
              <p className="text-sm">
                {original.kind === "proforma" ? "Issu du pro forma : " : "Facture d'origine : "}
                <Link className="font-medium text-brand-600 hover:underline" href={`/facturation/factures/${original.id}`}>
                  {original.code}
                </Link>
              </p>
            )}
            {inv.kind === "facture" && canBill && (
              <div className="mt-3">
                <label htmlFor="fne-select" className="mb-1 block text-theme-xs text-gray-500">Marquage FNE (informatif — conformité non simulée)</label>
                <select id="fne-select" value={inv.fneStatus ?? "non_renseigne"} onChange={(e) => run(setFneStatus, { id: inv.id, fne: e.target.value as NonNullable<typeof inv.fneStatus> })} className="h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                  <option value="non_renseigne">Non renseigné</option>
                  <option value="fne">FNE (informatif)</option>
                  <option value="hors_fne">Hors FNE</option>
                </select>
              </div>
            )}
          </ComponentCard>
          {!isAvoir && (
            <ComponentCard title="Paiements associés">
              {payments.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun paiement.</p>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span>
                      {formatDate(p.date)} · <StatusBadge kind="paymentMethod" value={p.method} />
                    </span>
                    <strong>{formatXOF(p.allocations.filter((a) => a.invoiceId === inv.id).reduce((s, a) => s + a.amount, 0))}</strong>
                  </div>
                ))
              )}
            </ComponentCard>
          )}
          {credits.length > 0 && (
            <ComponentCard title="Avoirs liés">
              {credits.map((c) => (
                <Link key={c.id} href={`/facturation/factures/${c.id}`} className="flex justify-between text-sm text-brand-600 hover:underline">
                  <span>{c.code} — {c.correctionReason}</span>
                  <span>− {formatXOF(docTotal(c.lines))}</span>
                </Link>
              ))}
            </ComponentCard>
          )}
        </div>
      </div>
      <DocumentEditorModal isOpen={edit.isOpen} onClose={edit.closeModal} kind="facture" invoice={inv} />
      {!isAvoir && <PaymentModal isOpen={pay.isOpen} onClose={pay.closeModal} invoiceId={inv.id} />}
      <CreditNoteModal invoice={credit ? inv : null} onClose={() => setCredit(false)} onCreated={(cid) => router.push(`/facturation/factures/${cid}`)} />
      <ConfirmDialog isOpen={cancel.isOpen} onClose={cancel.closeModal} title="Annuler le brouillon" tone="danger" message="Le brouillon sera annulé et les visites associées redeviendront facturables." reasonLabel="Motif" onConfirm={(reason) => run(cancelInvoice, { id: inv.id, reason }).ok} />
    </div>
  );
}
