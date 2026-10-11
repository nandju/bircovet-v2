"use client";

import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useRouter } from "@/i18n/navigation";
import { DownloadIcon, PlusIcon } from "@/icons";
import { productStock, supplierName } from "@/lib/calc";
import { formatXOF, normalize } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { exportCsv } from "@/utils/export";
import { useMemo, useState } from "react";
import { ProductFormModal } from "./StockModals";

export default function Catalog() {
  const { db, today } = useDemo();
  const opts = useOptions();
  const router = useRouter();
  const create = useModal();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const rows = useMemo(() => {
    const t = normalize(q);
    return db.products.filter((p) => (!f.category || p.category === f.category) && (!f.supplier || p.supplierId === f.supplier) && (!f.status || p.status === f.status) && (!t || normalize(`${p.name} ${p.code} ${p.description}`).includes(t)));
  }, [db, q, f]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Catalogue des articles"
        trail={[{ label: "Stock", href: "/stock" }]}
        actions={
          <>
            <Button size="sm" variant="outline" startIcon={<DownloadIcon />} onClick={() => exportCsv("bircovet-catalogue-demo", ["Code", "Nom", "Catégorie", "Unité achat", "Unité stock", "Unité vente", "Conversion", "Seuil", "Prix achat", "Prix vente", "Fournisseur", "Stock total", "Statut"], rows.map((p) => [p.code, p.name, labelOf("category", p.category), p.purchaseUnit, p.stockUnit, p.saleUnit, p.conversion, p.alertThreshold, p.purchasePrice, p.salePrice, supplierName(db, p.supplierId), productStock(db, p.id, undefined, today), labelOf("product", p.status)]))}>
              Export CSV
            </Button>
            <Can module="stock" action="create">
              <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
                Nouvel article
              </Button>
            </Can>
          </>
        }
      />
      <Panel>
        <FilterBar
          search={q}
          onSearch={setQ}
          searchPlaceholder="Nom, code, description…"
          values={f}
          onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))}
          filters={[
            { key: "category", label: "Toutes catégories", options: optionsOf("category") },
            { key: "supplier", label: "Tous fournisseurs", options: opts.suppliers },
            { key: "status", label: "Tous statuts", options: optionsOf("product") },
          ]}
        />
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/stock/articles/${p.id}`)}
          initialSort={{ key: "n", dir: "asc" }}
          columns={[
            { key: "n", header: "Article", primary: true, sortValue: (p) => p.name, render: (p) => <span className="flex flex-col"><span className="font-medium">{p.name}</span><span className="text-theme-xs text-gray-500">{p.code} · {p.form}</span></span> },
            { key: "c", header: "Catégorie", render: (p) => <StatusBadge kind="category" value={p.category} /> },
            { key: "u", header: "Unités (achat → stock)", hideOnMobile: true, render: (p) => `${p.purchaseUnit} → ${p.conversion} ${p.stockUnit}` },
            { key: "pa", header: "Prix achat", align: "end", render: (p) => formatXOF(p.purchasePrice) },
            { key: "pv", header: "Prix vente", align: "end", render: (p) => (p.salePrice ? formatXOF(p.salePrice) : "Non vendu") },
            { key: "s", header: "Stock utilisable", align: "end", sortValue: (p) => productStock(db, p.id, undefined, today), render: (p) => { const s = productStock(db, p.id, undefined, today); return <span className={s <= p.alertThreshold ? "font-medium text-warning-600" : ""}>{s}</span>; } },
            { key: "f", header: "Fournisseur", hideOnMobile: true, render: (p) => supplierName(db, p.supplierId) },
            { key: "st", header: "Statut", render: (p) => <StatusBadge kind="product" value={p.status} /> },
          ]}
        />
      </Panel>
      <ProductFormModal isOpen={create.isOpen} onClose={create.closeModal} onCreated={(id) => router.push(`/stock/articles/${id}`)} />
    </div>
  );
}
