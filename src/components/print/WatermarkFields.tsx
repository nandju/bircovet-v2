"use client";

import { CheckField, FormGrid, NumberField, TextField } from "@/components/form/Field";
import type { Watermark } from "@/lib/types";
import { WatermarkMark } from "./Watermark";

export default function WatermarkFields({ value, onChange, logo }: { value: Watermark; onChange: (v: Watermark) => void; logo?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_9rem]">
      <FormGrid cols={1}>
        <CheckField label="Imprimer un filigrane sur les documents" checked={value.enabled} onChange={(x) => onChange({ ...value, enabled: x })} hint="Factures, ordonnances, rapports, annuaires, bons de commande… et toute page imprimée." />
        <TextField label="Texte du filigrane" value={value.text} onChange={(x) => onChange({ ...value, text: x })} placeholder="Ex. : BIRCOVET, COPIE, CONFIDENTIEL" />
        <NumberField label="Intensité" suffix="%" value={value.opacity} onChange={(x) => onChange({ ...value, opacity: x })} min={3} max={40} step={1} />
        <CheckField label="Ajouter le logo" checked={value.withLogo} onChange={(x) => onChange({ ...value, withLogo: x })} disabled={!logo} hint={logo ? undefined : "Chargez d'abord un logo dans « Personnalisation de la plateforme »."} />
      </FormGrid>
      <div>
        <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Aperçu</p>
        <div className="relative aspect-[210/297] overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700">
          <div className="space-y-1.5 p-3">
            {[70, 90, 55, 80, 65, 85, 50].map((w, i) => <div key={i} className="h-1.5 rounded bg-gray-200" style={{ width: `${w}%` }} />)}
          </div>
          {value.enabled && <WatermarkMark wm={{ ...value, text: value.text }} logo={logo} className="absolute inset-0 [&_span]:text-[22px]" />}
        </div>
      </div>
    </div>
  );
}
