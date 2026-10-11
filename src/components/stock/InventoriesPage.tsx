"use client";

import ComponentCard from "@/components/common/ComponentCard";
import DemoNotice from "@/components/common/DemoNotice";
import EmptyState from "@/components/common/EmptyState";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { establishmentName, lotRef, productName, userName } from "@/lib/calc";
import { formatDateTime } from "@/lib/format";
import { proposeInventory, setInventoryCount, startInventory, validateInventory } from "@/lib/services/inventoryService";
import { cn } from "@/utils";
import { useState } from "react";

export default function InventoriesPage() {
  const { db, run, establishment, user, can } = useDemo();
  const [openId, setOpenId] = useState<string | null>(db.inventories.find((i) => i.status !== "valide")?.id ?? null);
  const inv = db.inventories.find((i) => i.id === openId);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Inventaires"
        trail={[{ label: "Stock", href: "/stock" }]}
        actions={
          can("stock", "create") && (
            <Button size="sm" onClick={() => { const r = run(startInventory, { establishmentId: establishment?.id ?? "" }); if (r.ok && r.data) setOpenId(r.data); }}>
              Ouvrir un inventaire — {establishment?.city}
            </Button>
          )
        }
      />
      <DemoNotice>Le comptage génère des propositions d&apos;écart. Elles ne modifient le stock qu&apos;après validation par le profil DG (et jamais en mode hors ligne).</DemoNotice>
      <ComponentCard title="Historique des inventaires">
        {db.inventories.length === 0 ? (
          <EmptyState title="Aucun inventaire" description="Ouvrez un inventaire pour compter les lots de l'établissement actif." />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {db.inventories.map((i) => (
              <li key={i.id}>
                <button onClick={() => setOpenId(i.id)} className={cn("flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-start text-sm hover:bg-gray-50 dark:hover:bg-white/3", openId === i.id && "bg-brand-25 dark:bg-brand-500/10")}>
                  <span>
                    <strong>{i.code}</strong> — {establishmentName(db, i.establishmentId)} · {formatDateTime(i.date)} · {userName(db, i.authorId)}
                  </span>
                  <StatusBadge kind="inventory" value={i.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </ComponentCard>
      {inv && (
        <ComponentCard
          title={`${inv.code} — comptage`}
          desc={`${inv.lines.filter((l) => l.counted !== null).length} / ${inv.lines.length} lignes comptées`}
          actions={
            <>
              {inv.status === "en_cours" && (
                <Button size="sm" variant="secondary" onClick={() => run(proposeInventory, { id: inv.id })}>
                  Proposer les écarts
                </Button>
              )}
              {inv.status === "propose" && user?.roleId === "dg" && (
                <Button size="sm" onClick={() => run(validateInventory, { id: inv.id })}>
                  Valider l&apos;inventaire (DG)
                </Button>
              )}
            </>
          }
        >
          <div className="custom-scrollbar overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-theme-xs text-gray-500">
                  <th className="px-2 py-2 text-start">Article / lot</th>
                  <th className="px-2 py-2 text-end">Théorique</th>
                  <th className="px-2 py-2 text-end">Compté</th>
                  <th className="px-2 py-2 text-end">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {inv.lines.map((l) => {
                  const lot = db.lots.find((x) => x.id === l.lotId);
                  const delta = l.counted === null ? null : l.counted - l.expected;
                  return (
                    <tr key={l.lotId}>
                      <td className="px-2 py-2">
                        {productName(db, lot?.productId)} <span className="text-theme-xs text-gray-500">({lotRef(db, l.lotId)})</span>
                      </td>
                      <td className="px-2 py-2 text-end">{l.expected}</td>
                      <td className="px-2 py-2 text-end">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          disabled={inv.status !== "en_cours"}
                          value={l.counted ?? ""}
                          onChange={(e) => run(setInventoryCount, { id: inv.id, lotId: l.lotId, counted: e.target.value === "" ? null : Number(e.target.value) }, { silent: true })}
                          className="h-9 w-24 rounded-lg border border-gray-300 bg-transparent px-2 text-end text-sm dark:border-gray-700 dark:bg-gray-900"
                          aria-label={`Quantité comptée ${lotRef(db, l.lotId)}`}
                        />
                      </td>
                      <td className={cn("px-2 py-2 text-end font-medium", delta ? (delta > 0 ? "text-success-600" : "text-error-600") : "text-gray-400")}>{delta === null ? "—" : delta > 0 ? `+${delta}` : delta}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ComponentCard>
      )}
    </div>
  );
}
