"use client";

import AppModal from "@/components/common/AppModal";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import PrintSheet from "@/components/print/PrintSheet";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useOptions } from "@/hooks/useOptions";
import { PrinterIcon } from "@/icons";
import { establishmentName, lotBlockReason, lotRef, productName, userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { receiveTransfer, transferStock } from "@/lib/services/inventoryService";
import type { StockTransfer } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

const STATUS: Record<StockTransfer["status"], { label: string; cls: string }> = {
  en_transit: { label: "En transit", cls: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" },
  recu: { label: "Reçu", cls: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300" },
  recu_ecart: { label: "Reçu avec écart", cls: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" },
  effectue: { label: "Effectué", cls: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300" },
  annule: { label: "Annulé", cls: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400" },
};
const short = (n: string) => n.replace("Cliva ", "");

/** Suivi : Envoyé → En transit → Reçu. */
function Track({ t }: { t: StockTransfer }) {
  const { db } = useDemo();
  const done = t.status !== "en_transit";
  const steps = [
    { label: "Envoyé", sub: `${formatDateTime(t.date)} · ${userName(db, t.userId)}`, on: true },
    { label: "En transit", sub: short(establishmentName(db, t.fromEstablishmentId)) + " → " + short(establishmentName(db, t.toEstablishmentId)), on: true },
    { label: t.status === "recu_ecart" ? `Reçu ${t.receivedQty}/${t.qty}` : "Reçu", sub: done && t.receivedAt ? `${formatDateTime(t.receivedAt)} · ${userName(db, t.receivedById)}` : "en attente de l'annexe", on: done },
  ];
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={i} className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center">
            <span className={cn("size-3 shrink-0 rounded-full border-2", s.on ? (t.status === "recu_ecart" && i === 2 ? "border-error-500 bg-error-500" : "border-brand-500 bg-brand-500") : "border-gray-300 bg-white dark:bg-gray-900")} />
            {i < steps.length - 1 && <span className={cn("h-0.5 flex-1", steps[i + 1].on ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700")} />}
          </div>
          <span className="mt-1 text-theme-xs font-medium text-gray-800 dark:text-white/90">{s.label}</span>
          <span className="pe-2 text-[11px] text-gray-500">{s.sub}</span>
        </li>
      ))}
    </ol>
  );
}

function ReceiveModal({ tr, onClose }: { tr: StockTransfer | null; onClose: () => void }) {
  const { db, run } = useDemo();
  const [qty, setQty] = useState(0);
  const [loc, setLoc] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (tr) {
      setQty(tr.qty);
      setLoc(tr.location ?? "");
      setNote("");
    }
  }, [tr]);
  if (!tr) return null;
  const lot = db.lots.find((l) => l.id === tr.lotId);
  const dest = db.establishments.find((e) => e.id === tr.toEstablishmentId);
  const gap = tr.qty - qty;
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="sm"
      title={`Réceptionner ${tr.code}`}
      description={`${productName(db, lot?.productId)} · lot ${lot?.ref} · envoyé : ${tr.qty}`}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={() => run(receiveTransfer, { id: tr.id, receivedQty: qty, location: loc, note }).ok && onClose()} disabled={gap > 0 && !note.trim()}>Valider la réception</Button>
        </>
      }
    >
      <FormGrid cols={1}>
        <NumberField label="Quantité réellement reçue" required value={qty} onChange={setQty} min={0} max={tr.qty} />
        <SelectField label="Rangement" value={loc} onChange={setLoc} options={(dest?.locations ?? []).map((l) => ({ value: l, label: l }))} />
        {tr.note && <p className="text-theme-xs text-gray-500">Note de l&apos;expéditeur : {tr.note}</p>}
        <TextAreaField label={gap > 0 ? `Motif de l'écart (${gap} manquant)` : "Observation (facultatif)"} required={gap > 0} value={note} onChange={setNote} rows={2} />
      </FormGrid>
    </AppModal>
  );
}

export default function TransfersPage() {
  const { db, run, establishment, today, can } = useDemo();
  const opts = useOptions();
  const [v, setV] = useState({ lotId: "", to: "", qty: 1, location: "", note: "" });
  const [receive, setReceive] = useState<StockTransfer | null>(null);
  const [print, setPrint] = useState(false);
  const [f, setF] = useState({ from: "", to: "", status: "", est: "", q: "" });
  const lots = db.lots.filter((l) => l.establishmentId === establishment?.id && !lotBlockReason(l, today) && l.qtyAvailable > 0);
  const dest = db.establishments.find((e) => e.id === v.to);
  const incoming = db.stockTransfers.filter((t) => t.status === "en_transit" && t.toEstablishmentId === establishment?.id);
  const outgoing = db.stockTransfers.filter((t) => t.status === "en_transit" && t.fromEstablishmentId === establishment?.id);
  const prodOf = (t: StockTransfer) => productName(db, db.lots.find((l) => l.id === t.lotId)?.productId);
  const history = db.stockTransfers.filter(
    (t) =>
      (!f.from || t.date.slice(0, 10) >= f.from) &&
      (!f.to || t.date.slice(0, 10) <= f.to) &&
      (!f.status || t.status === f.status) &&
      (!f.est || t.fromEstablishmentId === f.est || t.toEstablishmentId === f.est) &&
      (!f.q || `${prodOf(t)} ${lotRef(db, t.lotId)} ${t.code}`.toLowerCase().includes(f.q.toLowerCase())),
  );
  const filterText = [f.from && `du ${formatDate(f.from)}`, f.to && `au ${formatDate(f.to)}`, f.status && STATUS[f.status as StockTransfer["status"]].label, f.est && short(establishmentName(db, f.est)), f.q && `« ${f.q} »`].filter(Boolean) as string[];
  const editable = can("stock", "update");

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Transferts entre établissements" subtitle="Envoi, transit et réception par l'annexe" trail={[{ label: "Stock", href: "/stock" }]} />

      {incoming.length > 0 && (
        <ComponentCard title={`À réceptionner à ${short(establishment?.name ?? "")} · ${incoming.length}`} className="border-warning-300 dark:border-warning-700">
          <ul className="space-y-4">
            {incoming.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{t.code} · {t.qty} × {prodOf(t)}</p>
                  <p className="text-theme-xs text-gray-500">Lot {lotRef(db, t.lotId)} · depuis {short(establishmentName(db, t.fromEstablishmentId))}</p>
                  <div className="mt-2 max-w-md"><Track t={t} /></div>
                </div>
                {editable && <Button size="sm" onClick={() => setReceive(t)}>Réceptionner</Button>}
              </li>
            ))}
          </ul>
        </ComponentCard>
      )}

      {editable && (
        <ComponentCard title={`Nouveau transfert depuis ${short(establishment?.name ?? "")}`}>
          <FormGrid cols={3}>
            <SelectField label="Lot" required value={v.lotId} onChange={(lotId) => setV({ ...v, lotId })} options={lots.map((l) => ({ value: l.id, label: `${productName(db, l.productId)} — ${l.ref} (dispo ${l.qtyAvailable}, pér. ${formatDate(l.expiryDate)})` }))} className="sm:col-span-2" />
            <NumberField label="Quantité" required value={v.qty} onChange={(qty) => setV({ ...v, qty })} min={1} />
            <SelectField label="Destination" required value={v.to} onChange={(to) => setV({ ...v, to, location: db.establishments.find((e) => e.id === to)?.locations[0] ?? "" })} options={opts.establishments.filter((e) => e.value !== establishment?.id)} />
            <SelectField label="Rangement prévu" value={v.location} onChange={(location) => setV({ ...v, location })} options={(dest?.locations ?? []).map((l) => ({ value: l, label: l }))} />
            <TextField label="Note pour l'annexe" value={v.note} onChange={(note) => setV({ ...v, note })} placeholder="Ex. : chaîne du froid, à ranger au réfrigérateur" />
          </FormGrid>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-theme-xs text-gray-500">Le stock sort à l&apos;envoi et n&apos;entre chez l&apos;annexe qu&apos;après sa validation de réception (avec écart éventuel).</p>
            <Button disabled={!v.lotId || !v.to || !(v.qty > 0)} onClick={() => run(transferStock, { lotId: v.lotId, toEstablishmentId: v.to, qty: v.qty, location: v.location, note: v.note }).ok && setV({ lotId: "", to: "", qty: 1, location: "", note: "" })}>
              Envoyer le transfert
            </Button>
          </div>
        </ComponentCard>
      )}

      {outgoing.length > 0 && (
        <ComponentCard title={`Envois en cours · ${outgoing.length}`}>
          <ul className="space-y-4">
            {outgoing.map((t) => (
              <li key={t.id}>
                <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">{t.code} · {t.qty} × {prodOf(t)} → {short(establishmentName(db, t.toEstablishmentId))}</p>
                <div className="max-w-lg"><Track t={t} /></div>
              </li>
            ))}
          </ul>
        </ComponentCard>
      )}

      <ComponentCard
        title="Historique des transferts"
        actions={
          <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>
            Imprimer / PDF
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input type="date" aria-label="Du" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
          <input type="date" aria-label="Au" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
          <select aria-label="Statut" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
            <option value="">Tous statuts</option>
            {(["en_transit", "recu", "recu_ecart", "effectue"] as const).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <select aria-label="Établissement" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
            <option value="">Tous établissements</option>
            {db.establishments.map((e) => <option key={e.id} value={e.id}>{short(e.name)}</option>)}
          </select>
          <input type="search" aria-label="Article, lot, référence" placeholder="Article, lot, réf." value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="col-span-2 h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm sm:col-span-1 dark:border-gray-700 dark:text-white/90" />
        </div>
        <DataTable
          rows={history}
          rowKey={(t) => t.id}
          emptyTitle="Aucun transfert"
          columns={[
            { key: "c", header: "Réf.", primary: true, render: (t) => t.code },
            { key: "d", header: "Envoi", render: (t) => formatDateTime(t.date) },
            { key: "p", header: "Article / lot", render: (t) => `${prodOf(t)} — ${lotRef(db, t.lotId)}` },
            { key: "f", header: "De → vers", render: (t) => `${short(establishmentName(db, t.fromEstablishmentId))} → ${short(establishmentName(db, t.toEstablishmentId))}` },
            { key: "q", header: "Envoyé / reçu", align: "end", render: (t) => (t.receivedQty != null ? `${t.qty} / ${t.receivedQty}` : t.qty) },
            { key: "s", header: "Statut", render: (t) => <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS[t.status].cls)}>{STATUS[t.status].label}</span> },
            { key: "u", header: "Par", render: (t) => `${userName(db, t.userId)}${t.receivedById ? ` / ${userName(db, t.receivedById)}` : ""}` },
          ]}
        />
      </ComponentCard>

      <ReceiveModal tr={receive} onClose={() => setReceive(null)} />
      <PrintSheet
        open={print}
        onClose={() => setPrint(false)}
        title="Historique des transferts"
        filters={filterText}
        rows={history}
        rowKey={(t) => t.id}
        columns={[
          { header: "Réf.", render: (t) => t.code },
          { header: "Envoi", render: (t) => formatDateTime(t.date) },
          { header: "Article / lot", render: (t) => `${prodOf(t)} — ${lotRef(db, t.lotId)}` },
          { header: "De → vers", render: (t) => `${short(establishmentName(db, t.fromEstablishmentId))} → ${short(establishmentName(db, t.toEstablishmentId))}` },
          { header: "Envoyé", align: "end", render: (t) => t.qty },
          { header: "Reçu", align: "end", render: (t) => t.receivedQty ?? (t.status === "effectue" ? t.qty : "—") },
          { header: "Statut", render: (t) => STATUS[t.status].label },
          { header: "Réception", render: (t) => (t.receivedAt ? `${formatDate(t.receivedAt.slice(0, 10))} · ${userName(db, t.receivedById)}${t.receptionNote ? ` — ${t.receptionNote}` : ""}` : "") },
        ]}
      />
    </div>
  );
}
