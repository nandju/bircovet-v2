"use client";

import { NumberField, SelectField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon, TrashBinIcon } from "@/icons";
import { docTotal, lineTotal } from "@/lib/calc";
import { formatXOF, uid } from "@/lib/format";
import type { InvoiceLine } from "@/lib/types";

/** Éditeur de lignes (produits et services, quantités, prix, remises). */
export default function LinesEditor({ lines, onChange, disabled }: { lines: InvoiceLine[]; onChange: (l: InvoiceLine[]) => void; disabled?: boolean }) {
  const { db } = useDemo();
  const set = (i: number, patch: Partial<InvoiceLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const delegation = db.settings.discountDelegationPct;
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={l.id} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-gray-100 p-3 sm:grid-cols-[8rem_1fr_5rem_7rem_5rem_7rem_auto] dark:border-gray-800">
          <SelectField label="Type" value={l.kind} onChange={(x) => set(i, { kind: x as InvoiceLine["kind"], productId: undefined })} options={[{ value: "service", label: "Service" }, { value: "produit", label: "Produit" }]} disabled={disabled} />
          {l.kind === "produit" ? (
            <SelectField
              label="Produit"
              value={l.productId ?? ""}
              onChange={(x) => {
                const p = db.products.find((y) => y.id === x);
                set(i, { productId: x, label: p?.name ?? "", unitPrice: p?.salePrice ?? 0 });
              }}
              options={db.products.filter((p) => p.status === "actif" && p.salePrice > 0).map((p) => ({ value: p.id, label: p.name }))}
              disabled={disabled}
            />
          ) : (
            <TextField label="Libellé" value={l.label} onChange={(x) => set(i, { label: x })} disabled={disabled} />
          )}
          <NumberField label="Qté" value={l.qty} onChange={(x) => set(i, { qty: x })} min={1} disabled={disabled} />
          <NumberField label="Prix unit." value={l.unitPrice} onChange={(x) => set(i, { unitPrice: x })} min={0} step={500} disabled={disabled} />
          <NumberField label="Remise %" value={l.discountPct} onChange={(x) => set(i, { discountPct: Number.isFinite(x) ? x : 0 })} min={0} max={100} disabled={disabled} error={l.discountPct > delegation ? "Hors délégation" : undefined} />
          <div className="pb-3 text-end text-sm font-medium text-gray-800 dark:text-white/90">{formatXOF(lineTotal(l))}</div>
          {!disabled && (
            <Button size="sm" variant="ghost" onClick={() => onChange(lines.filter((_, j) => j !== i))} title="Retirer" className="mb-1">
              <TrashBinIcon className="size-4" />
            </Button>
          )}
          {l.source && <p className="col-span-full text-[11px] text-gray-500">Origine : {l.source.label} ({l.source.kind})</p>}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!disabled && (
          <Button size="xs" variant="outline" startIcon={<PlusIcon />} onClick={() => onChange([...lines, { id: uid("il"), label: "", kind: "service", qty: 1, unitPrice: 0, discountPct: 0 }])}>
            Ajouter une ligne
          </Button>
        )}
        <p className="ms-auto text-sm font-semibold text-gray-800 dark:text-white/90">Total : {formatXOF(docTotal(lines))}</p>
      </div>
      <p className="text-theme-xs text-gray-500">Remise au-delà de {delegation} % : validation DG requise.</p>
    </div>
  );
}
