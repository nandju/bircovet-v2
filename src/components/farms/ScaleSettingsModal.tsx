"use client";

import AppModal from "@/components/common/AppModal";
import { CheckField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { farmScale, HERD, scaleSettings } from "@/lib/farmProfile";
import { formatXOF } from "@/lib/format";
import { saveFarmScaleSettings } from "@/lib/services/farmsService";
import type { FarmScaleSettings } from "@/lib/types";
import { useEffect, useState } from "react";

const inp = "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2 text-sm tabular-nums dark:border-gray-700 dark:text-white/90";

/** Le DG fixe lui-même les seuils petit / moyen / gros et les libellés. */
export default function ScaleSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { db, run, today } = useDemo();
  const [v, setV] = useState<FarmScaleSettings>(() => scaleSettings(db));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialisation à l'ouverture
    if (isOpen) setV(scaleSettings(db));
  }, [isOpen, db]);
  const preview = { petit: 0, moyen: 0, gros: 0 };
  for (const f of db.farms.filter((x) => x.status === "actif")) preview[farmScale({ ...db, settings: { ...db.settings, farmScale: v } }, f, today).scale] += 1;
  const setHerd = (sp: string, i: 0 | 1, n: number) => setV({ ...v, herd: { ...v.herd, [sp]: (i === 0 ? [n, v.herd[sp][1]] : [v.herd[sp][0], n]) as [number, number] } });
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Catégories d'éleveurs"
      description="Une exploitation passe « moyenne » puis « grosse » à partir de ces effectifs (l'espèce la plus grande compte). Vous pouvez aussi fixer la catégorie à la main sur chaque fiche."
      footer={<><Button size="sm" variant="outline" onClick={onClose}>Annuler</Button><Button size="sm" onClick={() => run(saveFarmScaleSettings, v).ok && onClose()}>Enregistrer</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["petit", "moyen", "gros"] as const).map((k) => (
            <label key={k} className="text-theme-xs text-gray-600 dark:text-gray-400">
              Libellé « {k} »
              <input value={v.labels[k]} onChange={(e) => setV({ ...v, labels: { ...v.labels, [k]: e.target.value } })} className={inp} />
              <span className="mt-0.5 block text-[11px] text-gray-500">{preview[k]} exploitation(s)</span>
            </label>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-theme-xs text-gray-500">
              <th className="py-1 text-start font-medium">Espèce</th>
              <th className="py-1 text-start font-medium">{v.labels.moyen} dès</th>
              <th className="py-1 text-start font-medium">{v.labels.gros} dès</th>
            </tr>
          </thead>
          <tbody>
            {[...HERD, "Autre"].map((sp) => (
              <tr key={sp}>
                <td className="py-1 pe-2 text-gray-800 dark:text-white/90">{sp}</td>
                <td className="py-1 pe-2"><input type="number" min={0} value={v.herd[sp]?.[0] ?? 0} onChange={(e) => setHerd(sp, 0, Number(e.target.value))} className={inp} aria-label={`${sp} moyen`} /></td>
                <td className="py-1"><input type="number" min={0} value={v.herd[sp]?.[1] ?? 0} onChange={(e) => setHerd(sp, 1, Number(e.target.value))} className={inp} aria-label={`${sp} gros`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <CheckField label="Tenir compte des achats du client sur 12 mois" checked={v.useRevenue} onChange={(x) => setV({ ...v, useRevenue: x })} hint="Un client qui achète beaucoup peut monter de catégorie même avec un petit effectif." />
        {v.useRevenue && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-theme-xs text-gray-600 dark:text-gray-400">{v.labels.moyen} dès (FCFA)<input type="number" min={0} step={50000} value={v.revenue[0]} onChange={(e) => setV({ ...v, revenue: [Number(e.target.value), v.revenue[1]] })} className={inp} /><span className="text-[11px]">{formatXOF(v.revenue[0])}</span></label>
            <label className="text-theme-xs text-gray-600 dark:text-gray-400">{v.labels.gros} dès (FCFA)<input type="number" min={0} step={50000} value={v.revenue[1]} onChange={(e) => setV({ ...v, revenue: [v.revenue[0], Number(e.target.value)] })} className={inp} /><span className="text-[11px]">{formatXOF(v.revenue[1])}</span></label>
          </div>
        )}
      </div>
    </AppModal>
  );
}
