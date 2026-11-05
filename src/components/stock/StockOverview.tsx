"use client";

import { PharmacyRevenueCard } from "@/components/margins/MarginsParts";
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
import { defaultShelf, SHELVES } from "@/lib/pharma/shelves";
import { stockAlerts } from "@/lib/services/reportsService";
import { cn } from "@/utils";
import { useMemo, useState } from "react";

export default function StockOverview() {
  const { db, today, establishment } = useDemo();
  const router = useRouter();
  const alerts = useMemo(() => stockAlerts(db, today, establishment?.id), [db, today, establishment]);
  const value = db.lots.filter((l) => l.establishmentId === establishment?.id && l.status !== "perime").reduce((s, l) => s + l.qtyAvailable * l.unitCost, 0);
  const byCat = useMemo(() => {
    const cats = Array.from(new Set(db.products.map((p) => p.category)));
    return { labels: cats.map((c) => labelOf("category", c)), values: cats.map((c) => db.lots.filter((l) => l.establishmentId === establishment?.id && l.status !== "perime" && db.products.find((p) => p.id === l.productId)?.category === c).reduce((s, l) => s + l.qtyAvailable * l.unitCost, 0)) };
  }, [db, establishment]);
  const [shelf, setShelf] = useState<string | null>(null);
  const shelfOfProduct = (p: (typeof db.products)[number]) => p.shelf ?? defaultShelf(p.category) ?? "autre";
  const groups = useMemo(() => {
    const active = db.products.filter((p) => p.status === "actif");
    const g = new Map<string, { group: string; shelves: { key: string; label: string; products: typeof active; low: number }[] }>();
    for (const s of [...SHELVES, { key: "autre", group: "Autres articles", label: "Non classés" }]) {
      const products = active.filter((p) => shelfOfProduct(p) === s.key);
      if (!g.has(s.group)) g.set(s.group, { group: s.group, shelves: [] });
      g.get(s.group)!.shelves.push({ key: s.key, label: s.label, products, low: products.filter((p) => isLowStock(db, p.id, establishment?.id, today)).length });
    }
    return Array.from(g.values()).filter((x) => x.shelves.some((s) => s.products.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, establishment, today]);
  const shelfProducts = shelf ? db.products.filter((p) => p.status === "actif" && shelfOfProduct(p) === shelf) : db.products.filter((p) => p.status === "actif");

  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Pharmacie et stock" subtitle={`Vue générale — ${establishment?.name}`} />
      <PharmacyRevenueCard est={establishment?.id} />
      <div className="grid grid-cols-1 gap-3 2xsm:grid-cols-2 md:gap-4 xl:grid-cols-5">
        <StatCard label="Articles actifs" value={db.products.filter((p) => p.status === "actif").length} icon={<BoxIcon />} href="/stock/catalogue" />
        <StatCard label="Valeur du stock (coût)" value={formatXOF(value)} icon={<WalletIcon />} tone="tertiary" hint="Lots non périmés, établissement actif" />
        <StatCard label="Stock faible" value={alerts.low.length} icon={<AlertTriangleIcon />} tone="warning" href="/stock/alertes" />
        <StatCard label="Péremptions proches" value={alerts.expiring.length} icon={<LayersIcon />} tone="warning" href="/stock/alertes" hint={`Horizon ${db.settings.expiryAlertDays} jours`} />
        <StatCard label="Lots bloqués" value={alerts.expired.length + alerts.quarantine.length} icon={<LockIcon />} tone="error" href="/stock/lots" hint="Périmés ou en quarantaine" />
      </div>
      <section aria-labelledby="shelves-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="shelves-title" className="text-base font-semibold text-gray-800 dark:text-white/90">Rayons</h2>
          <p className="text-theme-xs text-gray-500">Classez un article dans un rayon depuis sa fiche pharmaceutique.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((g) => (
            <div key={g.group} className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-3 dark:border-gray-800 dark:bg-white/3">
              <p className="px-1 pb-2 text-sm font-semibold text-gray-800 dark:text-white/90">{g.group}</p>
              <ul className="space-y-1">
                {g.shelves.filter((s) => s.products.length).map((s) => (
                  <li key={s.key}>
                    <button onClick={() => setShelf(shelf === s.key ? null : s.key)} aria-pressed={shelf === s.key} className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition", shelf === s.key ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5")}>
                      <span>{s.label}</span>
                      <span className="flex items-center gap-1.5 text-theme-xs tabular-nums">
                        {s.low > 0 && <span className="rounded-full bg-warning-50 px-1.5 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">{s.low} faible</span>}
                        <span className="text-gray-500">{s.products.length}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <ComponentCard title={shelf ? `Stock · ${[...SHELVES, { key: "autre", group: "Autres", label: "Non classés" }].filter((s) => s.key === shelf).map((s) => `${s.group} ${s.label.toLowerCase()}`)[0]}` : "Stock par article"} className="xl:col-span-2" actions={<Link href="/stock/catalogue" className="text-theme-xs font-medium text-brand-600">Catalogue complet</Link>}>
          <DataTable
            rows={shelfProducts}
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
