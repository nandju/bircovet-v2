"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";

/** Encart d'annonce discret et configurable (paramètres → promo) — optionnel, non intrusif. */
export default function PromoBanner() {
  const { db, today } = useDemo();
  const p = db.settings.promo;
  if (!p?.active || !p.title) return null;
  if ((p.from && today < p.from) || (p.to && today > p.to)) return null;
  const cta = p.link ? (p.link.startsWith("/") ? <Link href={p.link} className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-theme-xs font-medium text-white hover:bg-white/25">En savoir plus</Link> : <a href={p.link} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-theme-xs font-medium text-white hover:bg-white/25">En savoir plus</a>) : null;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-linear-to-r from-brand-600 to-tertiary-600 px-4 py-3 text-white shadow-theme-sm print:hidden">
      {p.imageDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- image d'annonce configurable (data URL local)
        <img src={p.imageDataUrl} alt="" className="h-10 w-14 rounded-lg bg-white/10 object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{p.title}</p>
        {p.text && <p className="truncate text-theme-xs text-white/80">{p.text}</p>}
      </div>
      {cta}
    </div>
  );
}
