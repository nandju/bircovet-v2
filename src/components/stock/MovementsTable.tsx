"use client";

import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/tables/DataTable";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { lotRef, productName, userName } from "@/lib/calc";
import { formatDateTime } from "@/lib/format";
import type { StockMovement } from "@/lib/types";

const REF_LINK: Record<string, string> = { prescription: "/prescriptions", hospitalisation: "/hospitalisation/", mission: "/missions/", reception: "/achats/receptions", correction: "/stock/corrections", inventaire: "/stock/inventaires", transfert: "/stock/transferts" };

export default function MovementsTable({ rows, showProduct = true, pageSize = 12 }: { rows: StockMovement[]; showProduct?: boolean; pageSize?: number }) {
  const { db } = useDemo();
  return (
    <DataTable
      rows={rows}
      rowKey={(m) => m.id}
      pageSize={pageSize}
      initialSort={{ key: "d", dir: "desc" }}
      emptyTitle="Aucun mouvement"
      columns={[
        { key: "d", header: "Date", primary: true, sortValue: (m) => m.date, render: (m) => formatDateTime(m.date) },
        { key: "t", header: "Type", render: (m) => <StatusBadge kind="movement" value={m.type} /> },
        ...(showProduct ? [{ key: "p", header: "Article", render: (m: StockMovement) => productName(db, m.productId) }] : []),
        { key: "l", header: "Lot", render: (m) => lotRef(db, m.lotId) },
        { key: "q", header: "Quantité", align: "end", sortValue: (m) => m.qty, render: (m) => <span className={m.qty > 0 ? "font-medium text-success-600" : m.qty < 0 ? "font-medium text-error-600" : "text-gray-400"}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span> },
        {
          key: "r",
          header: "Origine",
          hideOnMobile: true,
          render: (m) => {
            if (!m.ref) return m.note;
            const base = REF_LINK[m.ref.kind];
            return base ? <Link className="text-brand-600 hover:underline" href={base.endsWith("/") ? `${base}${m.ref.id}` : base}>{m.note}</Link> : m.note;
          },
        },
        { key: "u", header: "Utilisateur", hideOnMobile: true, render: (m) => userName(db, m.userId) },
      ]}
    />
  );
}
