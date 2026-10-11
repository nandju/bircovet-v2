"use client";

import { BarChart } from "@/components/charts/AppCharts";
import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatCard from "@/components/common/StatCard";
import DataTable from "@/components/tables/DataTable";
import { useDemo } from "@/context/DemoStoreContext";
import { Link, useRouter } from "@/i18n/navigation";
import { AlertTriangleIcon, BoxIcon, LayersIcon, LockIcon, WalletIcon } from "@/icons";
import { isLowStock, productStock } from "@/lib/calc";
import { formatXOF } from "@/lib/format";
import { labelOf } from "@/lib/labels";
import { stockAlerts } from "@/lib/services/reportsService";
import { useMemo } from "react";

export default function StockOverview() {
  const { db, today, establishment } = useDemo();
  const router = useRouter();
  const alerts = useMemo(() => stockAlerts(db, today, establishment?.id), [db, today, establishment]);
  const value = db.lots.filter((l) => l.establishmentId === establishment?.id && l.status !== "perime").reduce((s, l) => s + l.qtyAvailable * l.unitCost, 0);
  const byCat = useMemo(() => {
    const cats = Array.from(new Set(db.products.map((p) => p.category)));
    return { labels: cats.map((c) => labelOf("category", c)), values: cats.map((c) => db.lots.filter((l) => l.establishmentId === establishment?.id && l.status !== "perime" && db.products.find((p) => p.id === l.productId)?.category === c).reduce((s, l) => s + l.qtyAvailable * l.unitCost, 0)) };
  }, [db, establishment]);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Pharmacie et stock" subtitle={`Vue générale — ${establishment?.name}`} />
      <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 md:gap-4 xl:grid-cols-5">
        <StatCard label="Articles actifs" value={db.products.filter((p) => p.status === "actif").length} icon={<BoxIcon />} href="/stock/catalogue" />
        <StatCard label="Valeur du stock (coût)" value={formatXOF(value)} icon={<WalletIcon />} tone="tertiary" hint="Lots non périmés, établissement actif" />
        <StatCard label="Stock faible" value={alerts.low.length} icon={<AlertTriangleIcon />} tone="warning" href="/stock/alertes" />
        <StatCard label="Péremptions proches" value={alerts.expiring.length} icon={<LayersIcon />} tone="warning" href="/stock/alertes" hint={`Horizon ${db.settings.expiryAlertDays} jours`} />
        <StatCard label="Lots bloqués" value={alerts.expired.length + alerts.quarantine.length} icon={<LockIcon />} tone="error" href="/stock/lots" hint="Périmés ou en quarantaine" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <ComponentCard title="Stock par article" className="xl:col-span-2" actions={<Link href="/stock/catalogue" className="text-theme-xs font-medium text-brand-600">Catalogue complet</Link>}>
          <DataTable
            rows={db.products.filter((p) => p.status === "actif")}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/stock/articles/${p.id}`)}
            pageSize={8}
            dense
            columns={[
              { key: "n", header: "Article", primary: true, sortValue: (p) => p.name, render: (p) => <span className="flex flex-col"><span className="font-medium">{p.name}</span><span className="text-theme-xs text-gray-500">{p.code}</span></span> },
              ...db.establishments.map((e) => ({ key: e.id, header: e.city, align: "end" as const, sortValue: (p: { id: string }) => productStock(db, p.id, e.id, today), render: (p: { id: string; stockUnit?: string }) => productStock(db, p.id, e.id, today) })),
              { key: "t", header: "Seuil", align: "end", render: (p) => p.alertThreshold },
              { key: "a", header: "État", render: (p) => (isLowStock(db, p.id, establishment?.id, today) ? <span className="text-theme-xs font-medium text-warning-600">Stock faible</span> : <span className="text-theme-xs text-success-600">OK</span>) },
            ]}
          />
        </ComponentCard>
        <ComponentCard title="Valeur par catégorie">
          <BarChart labels={byCat.labels} series={[{ name: "Valeur", data: byCat.values }]} currency horizontal height={300} />
        </ComponentCard>
      </div>
    </div>
  );
}
