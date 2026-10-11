"use client";

import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import DataTable from "@/components/tables/DataTable";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { productStock, supplierName } from "@/lib/calc";
import { stockAlerts } from "@/lib/services/reportsService";
import { useMemo } from "react";
import LotsTable from "./LotsTable";

export default function StockAlertsPage() {
  const { db, today, establishment, can } = useDemo();
  const router = useRouter();
  const a = useMemo(() => stockAlerts(db, today, establishment?.id), [db, today, establishment]);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Alertes de stock" subtitle={`${establishment?.name} · horizon de péremption ${db.settings.expiryAlertDays} jours (paramétrable)`} trail={[{ label: "Stock", href: "/stock" }]} />
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
    </div>
  );
}
