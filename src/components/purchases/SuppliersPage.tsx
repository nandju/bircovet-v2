"use client";

import { debtsBySupplier } from "@/lib/payables";
import { cn } from "@/utils";
import Can from "@/components/common/Can";
import FilterBar from "@/components/common/FilterBar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useRouter } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { formatXOF, normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { useMemo, useState } from "react";
import { SupplierModal } from "./PurchaseModals";

export default function SuppliersPage() {
  const { db, today } = useDemo();
  const router = useRouter();
  const create = useModal();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const debts = useMemo(() => new Map(debtsBySupplier(db, today).map((x) => [x.supplier.id, x])), [db, today]);
  const rows = useMemo(() => db.suppliers.filter((s) => (!f.status || s.status === f.status) && (!q || normalize(`${s.name} ${s.code} ${s.category}`).includes(normalize(q)))), [db, q, f]);
  return (
    <div>
      <PageBreadcrumb
        pageTitle="Fournisseurs"
        trail={[{ label: "Achats", href: "/achats" }]}
        actions={
          <Can module="achats" action="create">
            <Button size="sm" startIcon={<PlusIcon />} onClick={create.openModal}>
              Nouveau fournisseur
            </Button>
          </Can>
        }
      />
      <Panel>
        <FilterBar search={q} onSearch={setQ} values={f} onChange={(k, v) => setF((s) => ({ ...s, [k]: v }))} filters={[{ key: "status", label: "Tous statuts", options: optionsOf("supplier") }]} />
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          onRowClick={(s) => router.push(`/achats/fournisseurs/${s.id}`)}
          columns={[
            { key: "n", header: "Fournisseur", primary: true, sortValue: (s) => s.name, render: (s) => <span className="flex flex-col"><span className="font-medium">{s.name}</span><span className="text-theme-xs text-gray-500">{s.code}</span></span> },
            { key: "c", header: "Catégorie", render: (s) => <span className="flex flex-col"><span>{s.category}</span><span className="text-[11px] text-gray-500">{s.kind === "prestataire" ? "Prestataire" : "Fournisseur"}</span></span> },
            { key: "d", header: "Reste à payer", align: "end", sortValue: (s) => debts.get(s.id)?.remaining ?? 0, render: (s) => { const d = debts.get(s.id); return d ? <span className="flex flex-col items-end"><span className={cn("font-semibold tabular-nums", d.overdue ? "text-error-600" : "text-gray-800 dark:text-white/90")}>{formatXOF(d.remaining)}</span>{d.overdue > 0 && <span className="text-[11px] text-error-600">dont {formatXOF(d.overdue)} échus</span>}</span> : <span className="text-gray-400">—</span>; } },
            { key: "ct", header: "Contact", render: (s) => `${s.contactName} · ${s.phone}`, hideOnMobile: true },
            { key: "a", header: "Articles", align: "center", render: (s) => db.products.filter((p) => p.supplierId === s.id).length },
            { key: "v", header: "Volume commandé", align: "end", render: (s) => formatXOF(db.purchaseOrders.filter((p) => p.supplierId === s.id && p.status !== "annulee").reduce((t, p) => t + p.lines.reduce((x, l) => x + l.qtyOrdered * l.unitPrice, 0), 0)) },
            { key: "s", header: "Statut", render: (s) => <StatusBadge kind="supplier" value={s.status} /> },
          ]}
        />
      </Panel>
      <SupplierModal isOpen={create.isOpen} onClose={create.closeModal} />
    </div>
  );
}
