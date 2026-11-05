"use client";

import AppModal from "@/components/common/AppModal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { FormGrid, NumberField, SelectField, TextAreaField, TextField } from "@/components/form/Field";
import { PrintFrame, PrintHeader } from "@/components/print/PrintSheet";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { PlusIcon, PrinterIcon } from "@/icons";
import { CONDITIONS, EQUIPMENT_CATEGORIES, equipmentTotals, equipmentValue } from "@/lib/equipment";
import { formatDate, formatXOF, normalize } from "@/lib/format";
import { deleteEquipment, saveEquipment, type EquipmentInput } from "@/lib/services/equipmentService";
import type { Equipment } from "@/lib/types";
import { cn } from "@/utils";
import { exportCsv } from "@/utils/export";
import { useEffect, useMemo, useState } from "react";

const EMPTY: EquipmentInput = { name: "", category: EQUIPMENT_CATEGORIES[0], brand: "", serial: "", location: "", quantity: 1, unitCost: 0, purchaseDate: "", supplier: "", condition: "bon", warrantyUntil: "", nextMaintenance: "", invoiceUrl: "", notes: "" };

const condOf = (c: Equipment["condition"]) => CONDITIONS.find((x) => x.value === c) ?? CONDITIONS[1];

function Editor({ value, onClose }: { value: EquipmentInput | null; onClose: () => void }) {
  const { run } = useDemo();
  const [v, setV] = useState<EquipmentInput>(EMPTY);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recharge le formulaire à l'ouverture
    if (value) setV(value);
  }, [value]);
  if (!value) return null;
  const opt = (s?: string) => s?.trim() || undefined;
  const save = () => {
    const r = run(saveEquipment, { ...v, brand: opt(v.brand), serial: opt(v.serial), location: opt(v.location), supplier: opt(v.supplier), purchaseDate: opt(v.purchaseDate), warrantyUntil: opt(v.warrantyUntil), nextMaintenance: opt(v.nextMaintenance), invoiceUrl: opt(v.invoiceUrl), notes: opt(v.notes) });
    if (r.ok) onClose();
  };
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="lg"
      title={v.id ? "Modifier le matériel" : "Ajouter du matériel"}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={save} disabled={!v.name.trim()}>Enregistrer</Button>
        </>
      }
    >
      <FormGrid>
        <TextField label="Désignation" required value={v.name} onChange={(x) => setV({ ...v, name: x })} placeholder="Ex. : échographe portable" className="sm:col-span-2" />
        <SelectField label="Catégorie" value={v.category} onChange={(x) => setV({ ...v, category: x })} options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <SelectField label="État" value={v.condition} onChange={(x) => setV({ ...v, condition: x as Equipment["condition"] })} options={CONDITIONS.map((c) => ({ value: c.value, label: c.label }))} />
        <NumberField label="Quantité" value={v.quantity} onChange={(x) => setV({ ...v, quantity: x })} min={1} />
        <NumberField label="Montant d'achat unitaire" suffix="FCFA" value={v.unitCost} onChange={(x) => setV({ ...v, unitCost: x })} min={0} step={1000} />
        <TextField label="Date d'achat" type="date" value={v.purchaseDate ?? ""} onChange={(x) => setV({ ...v, purchaseDate: x })} />
        <TextField label="Fournisseur" value={v.supplier ?? ""} onChange={(x) => setV({ ...v, supplier: x })} />
        <TextField label="Marque / modèle" value={v.brand ?? ""} onChange={(x) => setV({ ...v, brand: x })} />
        <TextField label="N° de série" value={v.serial ?? ""} onChange={(x) => setV({ ...v, serial: x })} />
        <TextField label="Emplacement" value={v.location ?? ""} onChange={(x) => setV({ ...v, location: x })} placeholder="Ex. : salle de chirurgie" />
        <TextField label="Garantie jusqu'au" type="date" value={v.warrantyUntil ?? ""} onChange={(x) => setV({ ...v, warrantyUntil: x })} />
        <TextField label="Prochain entretien" type="date" value={v.nextMaintenance ?? ""} onChange={(x) => setV({ ...v, nextMaintenance: x })} />
        <TextField label="Lien de la facture (Drive…)" value={v.invoiceUrl ?? ""} onChange={(x) => setV({ ...v, invoiceUrl: x })} placeholder="https://…" />
        <TextAreaField label="Notes" value={v.notes ?? ""} onChange={(x) => setV({ ...v, notes: x })} rows={2} className="sm:col-span-2" />
      </FormGrid>
      <p className="mt-3 text-theme-sm text-gray-600 dark:text-gray-400">Valeur de la ligne : <strong className="tabular-nums">{formatXOF(equipmentValue(v))}</strong></p>
    </AppModal>
  );
}

export default function EquipmentPage() {
  const { db, run, user, establishment, today } = useDemo();
  const [edit, setEdit] = useState<EquipmentInput | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [cond, setCond] = useState("");
  const [print, setPrint] = useState(false);
  const est = establishment?.id;
  const totals = equipmentTotals(db, est);
  const rows = useMemo(() => {
    const t = normalize(q);
    return (db.equipment ?? [])
      .filter((e) => (!est || e.establishmentId === est) && (!cat || e.category === cat) && (!cond || e.condition === cond) && (!t || normalize(`${e.name} ${e.code} ${e.brand ?? ""} ${e.serial ?? ""} ${e.location ?? ""} ${e.supplier ?? ""}`).includes(t)))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [db.equipment, est, q, cat, cond]);
  const rowsValue = rows.reduce((s, e) => s + equipmentValue(e), 0);
  const maint = (db.equipment ?? []).filter((e) => e.nextMaintenance && e.nextMaintenance <= today && e.condition !== "reforme").length;
  const filters = [cat && `Catégorie : ${cat}`, cond && `État : ${condOf(cond as Equipment["condition"]).label}`, q && `Recherche : ${q}`].filter(Boolean) as string[];
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb
        pageTitle="Matériel et équipements"
        subtitle="Inventaire de ce qui est à la clinique, avec le montant d'achat"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => exportCsv("cliva-materiel", ["Code", "Désignation", "Catégorie", "Marque", "N° série", "Emplacement", "Qté", "Prix unitaire", "Valeur", "Date d'achat", "Fournisseur", "État"], rows.map((e) => [e.code, e.name, e.category, e.brand ?? "", e.serial ?? "", e.location ?? "", String(e.quantity), String(e.unitCost), String(equipmentValue(e)), e.purchaseDate ?? "", e.supplier ?? "", condOf(e.condition).label]))}>Export CSV</Button>
            <Button size="sm" variant="outline" startIcon={<PrinterIcon />} onClick={() => setPrint(true)}>Imprimer / PDF</Button>
            {user?.roleId !== "assistant" && user?.roleId !== "confrere" && <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit({ ...EMPTY })}>Ajouter du matériel</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="cliva-grad-gestion rounded-3xl p-4 text-white shadow-cliva">
          <p className="text-theme-xs opacity-85">Valeur d&apos;achat du matériel en place</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatXOF(totals.total)}</p>
          <p className="text-theme-xs opacity-85">{totals.items} élément(s), hors réformé</p>
        </div>
        {[
          ["Catégories", String(totals.byCat.length)],
          ["En panne", String(totals.broken)],
          ["Entretien à faire", String(maint)],
        ].map(([l, val]) => (
          <div key={l} className="rounded-3xl border border-gray-200/70 bg-white p-4 shadow-cliva dark:border-gray-800 dark:bg-white/3">
            <p className="text-theme-xs text-gray-500">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-800 dark:text-white/90">{val}</p>
          </div>
        ))}
      </div>
      {totals.byCat.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totals.byCat.map((c) => (
            <button key={c.category} type="button" onClick={() => setCat(cat === c.category ? "" : c.category)} aria-pressed={cat === c.category} className={cn("rounded-2xl border px-3 py-2 text-start", cat === c.category ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3")}>
              <span className="block text-theme-xs text-gray-500">{c.category} · {c.count}</span>
              <span className="block text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">{formatXOF(c.value)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-3xl border border-gray-200/70 bg-white shadow-cliva dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, n° de série, emplacement…" className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white" aria-label="Rechercher" />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {EQUIPMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={cond} onChange={(e) => setCond(e.target.value)} className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" aria-label="État">
            <option value="">Tous les états</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-white/5">
              <tr>{["Matériel", "Catégorie", "Emplacement", "Qté", "Prix unitaire", "Valeur", "Achat", "État", ""].map((h, i) => <th key={i} className={cn("px-3 py-2 font-medium", i >= 3 && i <= 5 ? "text-end" : "text-start")}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-gray-800 dark:text-white/90">{e.name}</span>
                    <span className="block text-theme-xs text-gray-500">{[e.code, e.brand, e.serial && `S/N ${e.serial}`].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{e.category}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{e.location || "—"}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{e.quantity}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{formatXOF(e.unitCost)}</td>
                  <td className="px-3 py-2 text-end font-semibold tabular-nums">{formatXOF(equipmentValue(e))}</td>
                  <td className="px-3 py-2 text-theme-xs text-gray-500">{e.purchaseDate ? formatDate(e.purchaseDate) : "—"}{e.supplier && <span className="block">{e.supplier}</span>}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", condOf(e.condition).tone)}>{condOf(e.condition).label}</span>
                    {e.nextMaintenance && e.condition !== "reforme" && <span className={cn("block text-[11px]", e.nextMaintenance <= today ? "text-error-600" : "text-gray-500")}>Entretien {formatDate(e.nextMaintenance)}</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-end">
                    {e.invoiceUrl && <a href={e.invoiceUrl} target="_blank" rel="noreferrer" className="me-2 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Facture</a>}
                    {user?.roleId !== "assistant" && user?.roleId !== "confrere" && <Button size="xs" variant="ghost" onClick={() => setEdit({ ...e })}>Modifier</Button>}
                    {user?.roleId === "dg" && <Button size="xs" variant="ghost" className="text-error-600" onClick={() => run(deleteEquipment, { id: e.id })}>Supprimer</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold dark:border-gray-700">
                  <td className="px-3 py-2" colSpan={5}>Total ({rows.length} ligne(s))</td>
                  <td className="px-3 py-2 text-end tabular-nums">{formatXOF(rowsValue)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">Aucun matériel.</p>}
      </div>
      <Editor value={edit} onClose={() => setEdit(null)} />
      <PrintFrame open={print} onClose={() => setPrint(false)} title="Inventaire du matériel">
        <PrintHeader title="Inventaire du matériel" sub={filters.length ? <p>{filters.join(" · ")}</p> : undefined} />
        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-900">{["Code", "Désignation", "Catégorie", "Emplacement", "Qté", "P.U.", "Valeur", "Achat", "État"].map((h, i) => <th key={h} className={cn("py-1 pe-2 font-semibold", i >= 4 && i <= 6 ? "text-end" : "text-start")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-gray-200">
                <td className="py-1 pe-2">{e.code}</td>
                <td className="py-1 pe-2">{e.name}{e.serial ? ` (S/N ${e.serial})` : ""}</td>
                <td className="py-1 pe-2">{e.category}</td>
                <td className="py-1 pe-2">{e.location ?? ""}</td>
                <td className="py-1 pe-2 text-end">{e.quantity}</td>
                <td className="py-1 pe-2 text-end">{formatXOF(e.unitCost)}</td>
                <td className="py-1 pe-2 text-end">{formatXOF(equipmentValue(e))}</td>
                <td className="py-1 pe-2">{e.purchaseDate ? formatDate(e.purchaseDate) : ""}</td>
                <td className="py-1 pe-2">{condOf(e.condition).label}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="py-2" colSpan={6}>Total</td>
              <td className="py-2 pe-2 text-end">{formatXOF(rowsValue)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </PrintFrame>
    </div>
  );
}
