"use client";

import { useDemo } from "@/context/DemoStoreContext";
import type { Watermark as WM } from "@/lib/types";
import { cn } from "@/utils";

export const DEFAULT_WATERMARK: WM = { enabled: false, text: "BIRCOVET", opacity: 8, withLogo: false };

/** Contenu du filigrane, réutilisé par l'aperçu des paramètres. */
export function WatermarkMark({ wm, logo, className }: { wm: WM; logo?: string; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none flex items-center justify-center overflow-hidden", className)} style={{ opacity: Math.min(40, Math.max(3, wm.opacity)) / 100 }}>
      <div className="flex -rotate-[30deg] flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo local */}
        {wm.withLogo && logo && <img src={logo} alt="" className="w-[45%] max-w-[90mm] grayscale" />}
        {wm.text.trim() && <span className="whitespace-nowrap text-[min(16vw,110px)] font-black uppercase tracking-widest text-gray-900">{wm.text}</span>}
      </div>
    </div>
  );
}

/**
 * Filigrane imprimé : invisible à l'écran, fixé en travers de chaque page imprimée.
 * `inFrame` : version placée dans l'aperçu d'impression (PrintFrame).
 */
export default function Watermark({ inFrame }: { inFrame?: boolean }) {
  const { db } = useDemo();
  const wm = db.settings.watermark;
  if (!wm?.enabled || (!wm.text.trim() && !(wm.withLogo && db.settings.branding?.logoDataUrl))) return null;
  return <WatermarkMark wm={wm} logo={db.settings.branding?.logoDataUrl} className={cn("cliva-watermark fixed inset-0 z-[100001]", inFrame ? "print:flex hidden" : "hidden print:flex")} />;
}
