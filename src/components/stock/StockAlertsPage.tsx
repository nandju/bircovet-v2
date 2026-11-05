"use client";

import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import DataTable from "@/components/tables/DataTable";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { productStock, supplierName } from "@/lib/calc";
import { stockAlerts } from "@/lib/services/reportsService";
import PrintSheet from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { PrinterIcon } from "@/icons";
import { formatDate } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { shelfLabel } from "@/lib/pharma/shelves";
import type { ProductCategory } from "@/lib/types";
import { useMemo, useState } from "react";
import LotsTable from "./LotsTable";

type AlertRow = { key: string; type: string; productId: string; lot?: string; expiry?: string; qty: number; threshold?: number; supplierId?: string };

export default function StockAlertsPage() {
  const { db, today, establishment, can } = useDemo();
  const router = useRouter();
  const a = useMemo(() => stockAlerts(db, today, establishment?.id), [db, today, establishment]);
  const [print, setPrint] = useState(false);
  const [ft, setFt] = useState({ type: "", cat: "", q: "" });
  const all: AlertRow[] = [
    ...a.low.map((p) => ({ key: `low-${p.id}`, type: "Stock faible", productId: p.id, qty: productStock(db, p.id, establishment?.id, today), threshold: p.alertThreshold, supplierId: p.supplierId })),
    ...a.expiring.map((l) => ({ key: `exp-${l.id}`, type: "Péremption proche", productId: l.productId, lot: l.ref, expiry: l.expiryDate, qty: l.qtyAvailable, supplierId: l.supplierId })),
    ...a.expired.map((l) => ({ key: `per-${l.id}`, type: "Périmé", productId: l.productId, lot: l.ref, expiry: l.expiryDate, qty: l.qtyAvailable, supplierId: l.supplierId })),
    ...a.quarantine.map((l) => ({ key: `qua-${l.id}`, type: "Quarantaine", productId: l.productId, lot: l.ref, expiry: l.expiryDate, qty: l.qtyAvailable, supplierId: l.supplierId })),
  ];
  const prod = (id: string) => db.products.find((p) => p.id === id);
  const rows = all.filter((r) => (!ft.type || r.type === ft.type) && (!ft.cat || prod(r.productId)?.category === ft.cat) && (!ft.q || (prod(r.productId)?.name ?? "").toLowerCase().includes(ft.q.toLowerCase())));
  const cats = Array.from(new Set(db.products.map((p) => p.category))) as ProductCategory[];
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Alertes de stock"
        subtitle={`${establishment?.name} · horizon de péremption ${db.settings.expiryAlertDays} jours (paramétrable)`}
        trail={[{ label: "Stock", href: "/stock" }]}
        actions={<Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer / PDF</Button>}
      />
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-3 dark:border-gray-800 dark:bg-white/3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtres d&apos;impression</span>
        <select aria-label="Type d'alerte" value={ft.type} onChange={(e) => setFt({ ...ft, type: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
          <option value="">Toutes les alertes</option>
          {["Stock faible", "Péremption proche", "Périmé", "Quarantaine"].map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Catégorie" value={ft.cat} onChange={(e) => setFt({ ...ft, cat: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
          <option value="">Toutes catégories</option>
          {cats.map((c) => <option key={c} value={c}>{labelOf("category", c)}</option>)}
        </select>
        <input type="search" aria-label="Article" placeholder="Article" value={ft.q} onChange={(e) => setFt({ ...ft, q: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
        <span className="ms-auto text-theme-xs text-gray-500">{rows.length} alerte(s)</span>
      </div>
      <ComponentCard title={`Stock faible (${a.low.length})`} actions={can("achats", "create") && <Link href="/achats?nouveau=1" className="text-sm font-medium text-brand-600">Créer une commande</Link>}>
        <DataTable
          rows={a.low}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/stock/articles/${p.id}`)}
          emptyTitle="Aucun article sous le seuil"
          columns={[
            { key: "n", header: "Article", primary: true, render: (p) => <span className="font-medium">{p.name}</span> },
            { key: "s", header: "Stock utilisable", align: "end", render: (p) => <span className="font-medium text-warning-600">{productStock(db, p.id, establishment?.id, today)}</span> },
            { key: "t", header: "Seuil", align: "end", render: (p) => p.alertThreshold },
            { key: "f", header: "Fournisseur", render: (p) => supplierName(db, p.supplierId) },
          ]}
        />
      </ComponentCard>
      <ComponentCard title={`Lots proches de la péremption (${a.expiring.length})`}>
        <LotsTable rows={a.expiring} />
      </ComponentCard>
      <ComponentCard title={`Lots périmés et en quarantaine (${a.expired.length + a.quarantine.length})`} desc="Bloqués pour toute délivrance">
        <LotsTable rows={[...a.expired, ...a.quarantine]} />
      </ComponentCard>
      <PrintSheet
        open={print}
        onClose={() => setPrint(false)}
        title={`Alertes de stock — ${establishment?.name ?? ""}`}
        filters={[ft.type, ft.cat && labelOf("category", ft.cat), ft.q && `« ${ft.q} »`].filter(Boolean) as string[]}
        rows={rows}
        rowKey={(r) => r.key}
        columns={[
          { header: "Alerte", render: (r) => r.type },
          { header: "Article", render: (r) => prod(r.productId)?.name },
          { header: "Rayon", render: (r) => shelfLabel(prod(r.productId)?.shelf) },
          { header: "Lot", render: (r) => r.lot ?? "—" },
          { header: "Péremption", render: (r) => (r.expiry ? formatDate(r.expiry) : "—") },
          { header: "Qté", align: "end", render: (r) => r.qty },
          { header: "Seuil", align: "end", render: (r) => r.threshold ?? "—" },
          { header: "Fournisseur", render: (r) => (r.supplierId ? supplierName(db, r.supplierId) : "—") },
        ]}
      />
    </div>
  );
}
