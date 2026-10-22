"use client";

import Can from "@/components/common/Can";
import ComponentCard from "@/components/common/ComponentCard";
import InfoGrid from "@/components/common/InfoGrid";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import StatusBadge from "@/components/common/StatusBadge";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { PencilIcon } from "@/icons";
import { isLowStock, productStock, supplierName } from "@/lib/calc";
import { formatXOF } from "@/lib/format";
import LotsTable from "./LotsTable";
import MovementsTable from "./MovementsTable";
import { ProductFormModal } from "./StockModals";

export default function ProductDetail({ id }: { id: string }) {
  const { db, today, establishment } = useDemo();
  const edit = useModal();
  const p = db.products.find((x) => x.id === id);
  if (!p) return <p className="text-sm text-gray-500">Article introuvable.</p>;
  const lots = db.lots.filter((l) => l.productId === p.id);
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle={p.name}
        subtitle={`${p.code} · ${p.form}`}
        trail={[{ label: "Stock", href: "/stock" }, { label: "Catalogue", href: "/stock/catalogue" }]}
        actions={
          <Can module="stock" action="update">
            <Button size="sm" variant="outline" startIcon={<PencilIcon />} onClick={edit.openModal}>
              Modifier
            </Button>
          </Can>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <ComponentCard title="Fiche article" className="lg:col-span-2">
          <InfoGrid
            cols={3}
            items={[
              { label: "Code", value: p.code },
              { label: "Catégorie", value: <StatusBadge kind="category" value={p.category} /> },
              { label: "Statut", value: <StatusBadge kind="product" value={p.status} /> },
              { label: "Unité d'achat", value: p.purchaseUnit },
              { label: "Unité de stockage", value: p.stockUnit },
              { label: "Unité de vente", value: p.saleUnit },
              { label: "Conversion", value: `1 ${p.purchaseUnit} = ${p.conversion} ${p.stockUnit}` },
              { label: "Prix d'achat", value: formatXOF(p.purchasePrice) },
              { label: "Prix de vente", value: p.salePrice ? formatXOF(p.salePrice) : "Non vendu" },
              { label: "Seuil d'alerte", value: p.alertThreshold },
              { label: "Fournisseur", value: supplierName(db, p.supplierId) },
              { label: "Principe actif / DCI", value: p.activeIngredient },
              { label: "Espèces ciblées", value: p.targetSpecies },
              { label: "Forme / présentation", value: p.form },
              { label: "Usage humain", value: p.humanUse ? "Oui — posologie non extrapolable" : undefined },
              { label: "Posologie (notice)", value: p.posologie, wide: true },
              { label: "Dosage structuré", value: p.dosage ? `${p.dosage.perKg} ${p.dosage.unit}${p.dosage.species ? ` — ${p.dosage.species}` : ""}${p.dosage.note ? ` · ${p.dosage.note}` : ""}` : undefined },
              { label: "Contre-indications", value: p.contraIndications, wide: true },
              { label: "Conservation", value: p.conservation },
              { label: "Description", value: p.description, wide: true },
            ]}
          />
          {p.humanUse && (
            <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-theme-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
              Produit à usage humain : aucune posologie humaine ne peut être appliquée automatiquement à un animal — validation vétérinaire obligatoire.
            </p>
          )}
        </ComponentCard>
        <ComponentCard title="Stock utilisable par établissement">
          {db.establishments.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span>{e.name.replace("Cliva ", "")}</span>
              <strong className={isLowStock(db, p.id, e.id, today) && e.id === establishment?.id ? "text-warning-600" : ""}>{productStock(db, p.id, e.id, today)} {p.stockUnit}(s)</strong>
            </div>
          ))}
          <p className="border-t border-gray-100 pt-2 text-theme-xs text-gray-500 dark:border-gray-800">Exclut les lots périmés, réservés ou en quarantaine.</p>
        </ComponentCard>
      </div>
      <ComponentCard title="Lots">
        <LotsTable rows={lots} showProduct={false} />
      </ComponentCard>
      <ComponentCard title="Historique des mouvements">
        <MovementsTable rows={db.movements.filter((m) => m.productId === p.id)} showProduct={false} pageSize={8} />
      </ComponentCard>
      <ProductFormModal isOpen={edit.isOpen} onClose={edit.closeModal} product={p} />
    </div>
  );
}
