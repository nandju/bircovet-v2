"use client";

import HeaderPopover, { headerIconBtn } from "@/components/header/HeaderPopover";
import { useDisplayPrefs, type TextSize } from "@/hooks/useDisplayPrefs";
import { cn } from "@/utils";
import { useEffect } from "react";

const SCALE: Record<TextSize, string> = { normal: "100%", grand: "112.5%", "tres-grand": "125%" };

/** Confort de lecture, propre à chaque appareil : taille du texte, animations, menu simplifié. */
export default function DisplaySettings() {
  const [pref, setPref] = useDisplayPrefs();
  useEffect(() => {
    document.documentElement.style.fontSize = SCALE[pref.size];
    document.documentElement.classList.toggle("cliva-calm", pref.calm);
  }, [pref.size, pref.calm]);
  return (
    <HeaderPopover
      className="sm:w-80"
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-expanded={open} className={headerIconBtn} aria-label="Affichage : taille du texte et menu" title="Affichage">
          <span className="text-sm font-bold">Aa</span>
        </button>
      )}
    >
      {() => (
        <div className="space-y-4 p-3">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Taille du texte</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Taille du texte">
              {(Object.keys(SCALE) as TextSize[]).map((s, i) => (
                <button key={s} role="radio" aria-checked={pref.size === s} onClick={() => setPref({ ...pref, size: s })} className={cn("rounded-xl border py-2 font-semibold", pref.size === s ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300")} style={{ fontSize: `${13 + i * 3}px` }}>
                  {s === "normal" ? "Normal" : s === "grand" ? "Grand" : "Très grand"}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={pref.simple} onChange={(e) => setPref({ ...pref, simple: e.target.checked })} className="mt-0.5 size-4 accent-brand-500" />
            <span>
              <span className="font-medium">Menu simplifié</span>
              <span className="block text-theme-xs text-gray-500">Seulement l&apos;essentiel dans le menu de gauche. Le reste reste accessible avec « Que voulez-vous faire ? ».</span>
            </span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={pref.calm} onChange={(e) => setPref({ ...pref, calm: e.target.checked })} className="size-4 accent-brand-500" />
            Réduire les animations
          </label>
          <p className="text-theme-xs text-gray-500">Réglages gardés sur cet appareil.</p>
        </div>
      )}
    </HeaderPopover>
  );
}
