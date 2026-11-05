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
import AppModal from "@/components/common/AppModal";
import { SelectField, TextField } from "@/components/form/Field";
import PrintSheet from "@/components/print/PrintSheet";
import { PrinterIcon } from "@/icons";
import { formatXOF } from "@/lib/format";
import { labelOf, optionsOf } from "@/lib/labels";
import { cn } from "@/utils";
import { useState } from "react";

export default function InventoriesPage() {
  const { db, run, establishment, user, can } = useDemo();
  const [openId, setOpenId] = useState<string | null>(db.inventories.find((i) => i.status !== "valide")?.id ?? null);
  const inv = db.inventories.find((i) => i.id === openId);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState({ category: "", search: "" });
  const [lf, setLf] = useState({ q: "", cat: "", gapsOnly: false });
  const [print, setPrint] = useState(false);
  const lineInfo = (lotId: string) => {
    const lot = db.lots.find((x) => x.id === lotId);
    const prod = db.products.find((x) => x.id === lot?.productId);
    return { lot, prod };
  };
  const lines = (inv?.lines ?? []).filter((l) => {
    const { prod } = lineInfo(l.lotId);
    const delta = l.counted === null ? null : l.counted - l.expected;
    return (!lf.q || `${prod?.name ?? ""} ${lotRef(db, l.lotId)}`.toLowerCase().includes(lf.q.toLowerCase())) && (!lf.cat || prod?.category === lf.cat) && (!lf.gapsOnly || (delta !== null && delta !== 0));
  });
  const gaps = (inv?.lines ?? []).filter((l) => l.counted !== null && l.counted !== l.expected);
  const gapValue = gaps.reduce((s, l) => s + (l.counted! - l.expected) * (lineInfo(l.lotId).lot?.unitCost ?? 0), 0);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Inventaires"
        trail={[{ label: "Stock", href: "/stock" }]}
        actions={
          can("stock", "create") && (
            <Button size="sm" onClick={() => setScopeOpen(true)}>
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
                    <strong>{i.code}</strong> — {establishmentName(db, i.establishmentId)} · {i.scope?.label ?? "Inventaire complet"} · {formatDateTime(i.date)} · {userName(db, i.authorId)}
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
          title={`${inv.code} — ${inv.scope?.label ?? "Inventaire complet"}`}
          desc={`${inv.lines.filter((l) => l.counted !== null).length} / ${inv.lines.length} lignes comptées · ${gaps.length} écart(s) · valeur des écarts ${formatXOF(gapValue)}`}
          actions={
            <>
              <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>
                Écarts en PDF
              </Button>
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
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" aria-label="Filtrer par nom ou lot" placeholder="Nom ou lot" value={lf.q} onChange={(e) => setLf({ ...lf, q: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90" />
            <select aria-label="Catégorie" value={lf.cat} onChange={(e) => setLf({ ...lf, cat: e.target.value })} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90">
              <option value="">Toutes catégories</option>
              {optionsOf("category").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={lf.gapsOnly} onChange={(e) => setLf({ ...lf, gapsOnly: e.target.checked })} className="size-4 rounded border-gray-300" />
              Écarts seulement
            </label>
            <span className="ms-auto text-theme-xs text-gray-500">{lines.length} ligne(s)</span>
          </div>
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
                {lines.map((l) => {
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
      <AppModal
        isOpen={scopeOpen}
        onClose={() => setScopeOpen(false)}
        size="sm"
        title="Ouvrir un inventaire"
        description={`${establishment?.name} · laissez vide pour un inventaire complet`}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setScopeOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={() => { const r = run(startInventory, { establishmentId: establishment?.id ?? "", category: scope.category || undefined, search: scope.search || undefined }); if (r.ok && r.data) { setOpenId(r.data); setScopeOpen(false); setScope({ category: "", search: "" }); } }}>Ouvrir</Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField label="Par catégorie" value={scope.category} onChange={(category) => setScope({ ...scope, category })} options={optionsOf("category")} allowEmpty placeholder="Toutes" />
          <TextField label="Par nom d'article" value={scope.search} onChange={(search) => setScope({ ...scope, search })} placeholder="Ex. : vaccin, amoxicilline" />
        </div>
      </AppModal>
      {inv && (
        <PrintSheet
          open={print}
          onClose={() => setPrint(false)}
          title={`Écarts d'inventaire ${inv.code}`}
          filters={[establishmentName(db, inv.establishmentId), inv.scope?.label ?? "Inventaire complet", `ouvert le ${formatDateTime(inv.date)}`, labelOf("inventory", inv.status)]}
          summary={<p><strong>{gaps.length}</strong> écart(s) sur {inv.lines.length} ligne(s) · valeur des écarts au coût d&apos;achat : <strong>{formatXOF(gapValue)}</strong></p>}
          rows={gaps}
          rowKey={(l) => l.lotId}
          emptyText="Aucun écart compté."
          columns={[
            { header: "Article", render: (l) => lineInfo(l.lotId).prod?.name },
            { header: "Catégorie", render: (l) => labelOf("category", lineInfo(l.lotId).prod?.category) },
            { header: "Lot", render: (l) => lotRef(db, l.lotId) },
            { header: "Théorique", align: "end", render: (l) => l.expected },
            { header: "Compté", align: "end", render: (l) => l.counted },
            { header: "Écart", align: "end", render: (l) => { const dl = l.counted! - l.expected; return dl > 0 ? `+${dl}` : dl; } },
            { header: "Valeur", align: "end", render: (l) => formatXOF((l.counted! - l.expected) * (lineInfo(l.lotId).lot?.unitCost ?? 0)) },
          ]}
        />
      )}
    </div>
  );
}
