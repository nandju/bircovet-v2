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
import { cancelInvoice, submitInvoice, validateInvoice } from "@/lib/services/invoicesService";
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
        pageTitle={`${isAvoir ? "Avoir" : "Facture"} ${inv.code}`}
        subtitle={`${clientName(db, inv.clientId)} · ${labelOf("invoice", inv.status)}`}
        trail={[{ label: isAvoir ? "Avoirs" : "Factures", href: isAvoir ? "/facturation/avoirs" : "/facturation" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={printPage}>
              Imprimer / PDF
            </Button>
            {draft && canBill && (
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
            {!isAvoir && isActiveInvoice(inv) && invoiceBalance(db, inv) > 0 && can("finances", "create") && (
              <Button size="sm" onClick={pay.openModal}>
                Enregistrer un paiement
              </Button>
            )}
            {!isAvoir && isActiveInvoice(inv) && canValidate && (
              <Button size="sm" variant="outline" onClick={() => setCredit(true)}>
                Corriger par avoir
              </Button>
            )}
          </>
        }
      />
      {discountOver && draft && <DemoNotice tone="warning">Remise hors délégation ({maxDiscount(inv.lines)} % &gt; {db.settings.discountDelegationPct} %) : seule une validation par le profil DG est possible.</DemoNotice>}
      {!draft && !isAvoir && <DemoNotice>Facture validée : elle ne peut plus être modifiée. Toute correction passe par un avoir lié, avec motif.</DemoNotice>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="xl:col-span-2">
          <BillingDocument
            title={isAvoir ? "Avoir" : "Facture"}
            code={inv.code}
            date={inv.date}
            secondDate={isAvoir ? undefined : { label: "Échéance", value: inv.dueDate }}
            clientName={clientName(db, inv.clientId)}
            payerName={inv.payerName}
            lines={inv.lines}
            notes={[inv.notes, isAvoir && original ? `Avoir lié à la facture ${original.code}. Motif : ${inv.correctionReason}` : ""].filter(Boolean).join(" — ")}
            footerRows={
              isAvoir
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
              ]}
            />
            {original && (
              <p className="text-sm">
                Facture d&apos;origine :{" "}
                <Link className="font-medium text-brand-600 hover:underline" href={`/facturation/factures/${original.id}`}>
                  {original.code}
                </Link>
              </p>
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
