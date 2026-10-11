"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { Link, useRouter } from "@/i18n/navigation";
import { PrinterIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { convertQuote, setQuoteStatus } from "@/lib/services/invoicesService";
import { printPage } from "@/utils/export";
import BillingDocument from "./BillingDocument";
import { DocumentEditorModal } from "./BillingModals";

export default function QuoteDetail({ id }: { id: string }) {
  const { db, run, can } = useDemo();
  const router = useRouter();
  const edit = useModal();
  const q = db.quotes.find((x) => x.id === id);
  if (!q) return <p className="text-sm text-gray-500">Devis introuvable.</p>;
  const canBill = can("facturation", "create");
  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle={`Devis ${q.code}`}
        subtitle={clientName(db, q.clientId)}
        trail={[{ label: "Devis", href: "/facturation/devis" }]}
        actions={
          <>
            <StatusBadge kind="quote" value={q.status} size="md" />
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={printPage}>
              Aperçu imprimable
            </Button>
            {canBill && q.status === "brouillon" && (
              <>
                <Button size="sm" variant="outline" onClick={edit.openModal}>
                  Modifier
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run(setQuoteStatus, { id: q.id, status: "envoye" })}>
                  Marquer envoyé (simulé)
                </Button>
              </>
            )}
            {canBill && (q.status === "envoye" || q.status === "brouillon") && (
              <>
                <Button size="sm" variant="soft" onClick={() => run(setQuoteStatus, { id: q.id, status: "accepte" })}>
                  Accepté
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(setQuoteStatus, { id: q.id, status: "refuse" })}>
                  Refusé
                </Button>
              </>
            )}
            {canBill && q.status === "accepte" && (
              <Button size="sm" onClick={() => { const r = run(convertQuote, { id: q.id }); if (r.ok && r.data) router.push(`/facturation/factures/${r.data}`); }}>
                Convertir en facture
              </Button>
            )}
            {q.invoiceId && (
              <Link href={`/facturation/factures/${q.invoiceId}`} className="text-sm font-medium text-brand-600">
                Voir la facture
              </Link>
            )}
          </>
        }
      />
      <BillingDocument
        title="Devis"
        code={q.code}
        date={q.date}
        secondDate={{ label: "Valable jusqu'au", value: q.validUntil }}
        clientName={clientName(db, q.clientId)}
        payerName={db.clients.find((c) => c.id === q.clientId)?.payerName ?? ""}
        lines={q.lines}
        notes={q.notes}
        meta={[...(q.patientId ? [{ label: "Patient", value: patientName(db, q.patientId) }] : []), { label: "Établi par", value: userName(db, q.authorId) }]}
      />
      <DocumentEditorModal isOpen={edit.isOpen} onClose={edit.closeModal} kind="devis" quote={q} />
    </div>
  );
}
