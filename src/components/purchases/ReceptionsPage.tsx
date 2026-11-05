"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import { SelectField, TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { Link } from "@/i18n/navigation";
import { DownloadIcon, UploadIcon } from "@/icons";
import { productName, supplierName, userName } from "@/lib/calc";
import { addDays, daysBetween, formatDate, formatDateTime } from "@/lib/format";
import PrintSheet from "@/components/print/PrintSheet";
import { PrinterIcon } from "@/icons";
import { checkReceptionLine, createReception, parseBLI, receivedForLine, rejectReception, validateReception } from "@/lib/services/suppliersService";
import type { Reception } from "@/lib/types";
import { downloadText } from "@/utils/export";
import { cn } from "@/utils";
import { useState } from "react";

export default function ReceptionsPage() {
  const { db, run, today, can } = useDemo();
  const opts = useOptions();
  const bli = useModal();
  const [reject, setReject] = useState<Reception | null>(null);
  const [text, setText] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [ref, setRef] = useState("");
  const sample = `# Exemple de fichier BLI/EDI simplifié (démonstration)\nCODE_ARTICLE;QTE;LOT;PEREMPTION;PRIX_UNITAIRE\nCON-001;100;BLI-SR-${today.replace(/-/g, "")};${addDays(today, 800)};60\nAPR-002;50;BLI-VM-${today.replace(/-/g, "")};${addDays(today, 500)};350\n`;
  const parsed = text ? parseBLI(db, text) : { lines: [], errors: [] };
  const canValidate = can("achats", "create") && can("stock", "update");
  const [lineCheck, setLineCheck] = useState<{ rec: Reception; lineId: string; status: "ecart" | "refuse" } | null>(null);
  const [lcQty, setLcQty] = useState(0);
  const [lcNote, setLcNote] = useState("");
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingSup, setMissingSup] = useState("");
  const missing = db.purchaseOrders
    .filter((po) => ["envoyee", "partiellement_recue"].includes(po.status) && (!missingSup || po.supplierId === missingSup))
    .flatMap((po) => po.lines.map((l) => ({ po, l, received: receivedForLine(db, l.id) })))
    .filter((x) => x.received < x.l.qtyOrdered)
    .sort((a, b) => a.po.expectedDate.localeCompare(b.po.expectedDate));

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        pageTitle="Réceptions fournisseurs"
        trail={[{ label: "Achats", href: "/achats" }]}
        actions={
          <>
          <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setMissingOpen(true)}>
            Commandes non reçues ({missing.length})
          </Button>
          <Can module="stock" action="create">
            <Button size="sm" variant="outline" startIcon={<UploadIcon />} onClick={() => { setText(""); setSupplierId(""); setRef(""); bli.openModal(); }}>
              Importer un BLI / EDI (simulé)
            </Button>
          </Can>
          </>
        }
      />
      <DemoNotice>Une réception — saisie ou importée — est toujours « proposée » : elle n&apos;augmente le stock vendable qu&apos;après validation. Les écarts entre quantités commandées et reçues restent visibles.</DemoNotice>
      <div className="space-y-3">
        {db.receptions.length === 0 && <p className="text-sm text-gray-500">Aucune réception.</p>}
        {db.receptions.map((r) => {
          const po = db.purchaseOrders.find((p) => p.id === r.poId);
          return (
            <Panel key={r.id} className="px-0">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {r.code} · {supplierName(db, r.supplierId)} {po && <Link href={`/achats/commandes/${po.id}`} className="ms-1 text-theme-xs font-normal text-brand-600">({po.code})</Link>}
                  </p>
                  <p className="text-theme-xs text-gray-500">
                    {formatDate(r.date)} · BL {r.deliveryNoteRef || "—"} · {r.source === "bli_edi" ? "Import BLI/EDI simulé" : "Saisie manuelle"} · {userName(db, r.authorId)}
                    {r.validatedById && ` · validée par ${userName(db, r.validatedById)} le ${formatDateTime(r.validatedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge kind="reception" value={r.status} />
                  {r.status === "proposee" && (
                    <span className="text-theme-xs text-gray-500">{r.lines.filter((l) => l.check).length}/{r.lines.length} contrôlée(s)</span>
                  )}
                  {r.status === "proposee" && canValidate && (
                    <>
                      <Button size="xs" disabled={r.lines.some((l) => !l.check)} onClick={() => run(validateReception, { id: r.id })}>
                        Valider l&apos;entrée en stock
                      </Button>
                      <Button size="xs" variant="ghost" className="text-error-600" onClick={() => setReject(r)}>
                        Rejeter
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="custom-scrollbar mt-3 overflow-x-auto px-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-theme-xs text-gray-500">
                      <th className="py-1.5 text-start">Article</th>
                      <th className="py-1.5 text-end">Attendu</th>
                      <th className="py-1.5 text-end">Reçu</th>
                      <th className="py-1.5 text-end">Écart</th>
                      <th className="py-1.5 ps-3 text-start">Lot / péremption</th>
                      <th className="py-1.5 ps-3 text-start">Contrôle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {r.lines.map((l) => {
                      const gap = l.qtyReceived - l.qtyOrdered;
                      return (
                        <tr key={l.id}>
                          <td className="py-1.5">{productName(db, l.productId)}</td>
                          <td className="py-1.5 text-end">{l.qtyOrdered}</td>
                          <td className="py-1.5 text-end font-medium">{l.qtyReceived}</td>
                          <td className={cn("py-1.5 text-end font-medium", gap < 0 ? "text-warning-600" : gap > 0 ? "text-tertiary-600" : "text-gray-400")}>{gap === 0 ? "—" : gap > 0 ? `+${gap}` : gap}</td>
                          <td className="py-1.5 ps-3 text-theme-xs text-gray-500">{l.lotRef || "—"} · {formatDate(l.expiryDate)}</td>
                          <td className="py-1.5 ps-3">
                            {l.check ? (
                              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", l.check.status === "conforme" ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" : l.check.status === "ecart" ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" : "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300")} title={l.check.note}>
                                {l.check.status === "conforme" ? "Conforme" : l.check.status === "ecart" ? "Écart" : "Refusé"}
                                {l.check.note ? ` · ${l.check.note}` : ""}
                              </span>
                            ) : r.status === "proposee" && canValidate ? (
                              <span className="flex flex-wrap gap-1">
                                <Button size="xs" variant="soft" onClick={() => run(checkReceptionLine, { id: r.id, lineId: l.id, status: "conforme" })}>Conforme</Button>
                                <Button size="xs" variant="ghost" onClick={() => { setLineCheck({ rec: r, lineId: l.id, status: "ecart" }); setLcQty(l.qtyReceived); setLcNote(""); }}>Écart</Button>
                                <Button size="xs" variant="ghost" className="text-error-600" onClick={() => { setLineCheck({ rec: r, lineId: l.id, status: "refuse" }); setLcNote(""); }}>Refuser</Button>
                              </span>
                            ) : (
                              <span className="text-theme-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })}
      </div>
      <AppModal
        isOpen={bli.isOpen}
        onClose={bli.closeModal}
        size="lg"
        title="Import BLI / EDI (simulation)"
        description="Le fichier crée une réception PROPOSÉE — jamais une augmentation automatique du stock."
        footer={
          <>
            <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => downloadText("exemple-bli-cliva.csv", sample, "text/csv")}>
              Télécharger l&apos;exemple
            </Button>
            <Button size="sm" variant="outline" onClick={bli.closeModal}>
              Annuler
            </Button>
            <Button size="sm" disabled={!supplierId || !parsed.lines.length} onClick={() => run(createReception, { supplierId, deliveryNoteRef: ref || "BLI-IMPORT", lines: parsed.lines, source: "bli_edi" }).ok && bli.closeModal()}>
              Créer la réception proposée ({parsed.lines.length} ligne(s))
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label="Fournisseur" required value={supplierId} onChange={setSupplierId} options={opts.suppliers} />
            <TextField label="Référence BLI" value={ref} onChange={setRef} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
              }}
              className="block text-sm text-gray-600 file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700 dark:text-gray-400"
            />
            <Button size="xs" variant="ghost" onClick={() => setText(sample)}>
              Utiliser l&apos;exemple
            </Button>
          </div>
          <TextAreaField label="Contenu (CODE_ARTICLE;QTE;LOT;PEREMPTION;PRIX_UNITAIRE)" value={text} onChange={setText} rows={6} />
          {parsed.errors.length > 0 && <DemoNotice tone="warning">{parsed.errors.join(" ")}</DemoNotice>}
          {parsed.lines.length > 0 && (
            <ul className="text-sm">
              {parsed.lines.map((l) => (
                <li key={l.id}>
                  ✓ {productName(db, l.productId)} × {l.qtyReceived} — lot {l.lotRef}, pér. {formatDate(l.expiryDate)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppModal>
      {lineCheck && (
        <AppModal
          isOpen
          onClose={() => setLineCheck(null)}
          size="sm"
          title={lineCheck.status === "ecart" ? "Écart sur la ligne" : "Refuser la ligne"}
          description={productName(db, lineCheck.rec.lines.find((x) => x.id === lineCheck.lineId)?.productId)}
          footer={
            <>
              <Button size="sm" variant="outline" onClick={() => setLineCheck(null)}>Annuler</Button>
              <Button size="sm" variant={lineCheck.status === "refuse" ? "danger" : "primary"} disabled={!lcNote.trim()} onClick={() => run(checkReceptionLine, { id: lineCheck.rec.id, lineId: lineCheck.lineId, status: lineCheck.status, qtyReceived: lcQty, note: lcNote }).ok && setLineCheck(null)}>Enregistrer</Button>
            </>
          }
        >
          <div className="space-y-3">
            {lineCheck.status === "ecart" && <TextField label="Quantité réellement reçue" type="number" value={String(lcQty)} onChange={(x) => setLcQty(Number(x))} />}
            <TextAreaField label={lineCheck.status === "ecart" ? "Nature de l'écart" : "Motif du refus"} required value={lcNote} onChange={setLcNote} rows={2} placeholder={lineCheck.status === "refuse" ? "Ex. : flacons cassés, péremption trop courte, chaîne du froid rompue" : "Ex. : 2 boîtes manquantes"} />
          </div>
        </AppModal>
      )}
      <PrintSheet
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        title="Commandes non reçues"
        toolbar={
          <>
            <span className="text-sm text-gray-600 dark:text-gray-400">Fournisseur</span>
            <select aria-label="Fournisseur" value={missingSup} onChange={(e) => setMissingSup(e.target.value)} className="h-9 flex-1 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
              <option value="">Tous</option>
              {opts.suppliers.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        }
        filters={[missingSup ? supplierName(db, missingSup) : "Tous les fournisseurs", "commandes envoyées ou partiellement reçues"]}
        summary={<p><strong>{missing.length}</strong> ligne(s) en attente · valeur restante : <strong>{missing.reduce((s, x) => s + (x.l.qtyOrdered - x.received) * x.l.unitPrice, 0).toLocaleString("fr-FR")} F CFA</strong></p>}
        rows={missing}
        rowKey={(x) => x.l.id}
        emptyText="Toutes les commandes envoyées ont été reçues."
        columns={[
          { header: "Commande", render: (x) => x.po.code },
          { header: "Fournisseur", render: (x) => supplierName(db, x.po.supplierId) },
          { header: "Article", render: (x) => productName(db, x.l.productId) },
          { header: "Commandé", align: "end", render: (x) => x.l.qtyOrdered },
          { header: "Reçu", align: "end", render: (x) => x.received },
          { header: "Reste", align: "end", render: (x) => x.l.qtyOrdered - x.received },
          { header: "Prévu le", render: (x) => formatDate(x.po.expectedDate) },
          { header: "Retard", align: "end", render: (x) => (x.po.expectedDate < today ? `${daysBetween(x.po.expectedDate, today)} j` : "—") },
        ]}
      />
      <ConfirmDialog isOpen={!!reject} onClose={() => setReject(null)} title="Rejeter la réception" message="Aucun mouvement de stock ne sera créé." reasonLabel="Motif" onConfirm={(reason) => (reject ? run(rejectReception, { id: reject.id, reason }).ok : false)} />
    </div>
  );
}
