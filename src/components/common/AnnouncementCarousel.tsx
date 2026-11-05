"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { liveAnnouncements } from "@/lib/announcements";
import { trackAnnouncement } from "@/lib/services/adminService";
import type { Announcement } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useRef, useState } from "react";

const ROTATE_MS = 7000;

/**
 * Annonces et actualités en rotation douce (fondu), pause au survol,
 * points de navigation ; vues et clics comptés pour les partenaires.
 */
export default function AnnouncementCarousel({ placement, tone = "light", className }: { placement: Announcement["placements"][number]; tone?: "light" | "dark"; className?: string }) {
  const { db, run, today, user } = useDemo();
  const list = liveAnnouncements(db, placement, today);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const seen = useRef(new Set<string>());
  const n = list.length;
  const idx = n ? i % n : 0;
  const cur = list[idx];

  useEffect(() => {
    if (n < 2 || paused) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => x + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [n, paused]);

  useEffect(() => {
    if (!cur || seen.current.has(cur.id) || !user) return;
    seen.current.add(cur.id);
    run(trackAnnouncement, { id: cur.id, kind: "view" }, { silent: true });
  }, [cur, run, user]);

  if (!cur) return null;
  const click = () => user && run(trackAnnouncement, { id: cur.id, kind: "click" }, { silent: true });
  const label = cur.kind === "pub" ? `Sponsorisé${cur.sponsor ? ` · ${cur.sponsor}` : ""}${cur.platform ? " · Partenaire Cliva" : ""}` : "Actualité";
  const dark = tone === "dark";
  const body = (
    <div key={cur.id} className={cn("cliva-fade flex min-w-0 gap-4", dark ? "flex-col" : "items-center")}>
      {cur.imageDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- image ou GIF de l'annonce (data URL)
        <img src={cur.imageDataUrl} alt="" className={dark ? "aspect-[16/7] w-full rounded-xl object-cover" : "h-20 w-32 shrink-0 rounded-xl object-cover sm:h-24 sm:w-44"} />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11px] font-medium tracking-wide uppercase", dark ? "text-white/60" : "text-gray-500 dark:text-gray-400")}>{label}</p>
        <p className={cn("mt-0.5 truncate text-sm font-semibold sm:text-base", dark ? "text-white" : "text-gray-900 dark:text-white")}>{cur.title}</p>
        {cur.text && <p className={cn("mt-0.5 line-clamp-2 text-theme-xs sm:text-sm", dark ? "text-white/75" : "text-gray-600 dark:text-gray-300")}>{cur.text}</p>}
        {cur.link && <span className={cn("mt-1.5 inline-block text-theme-xs font-semibold", dark ? "text-white underline" : "text-brand-600 dark:text-brand-400")}>En savoir plus →</span>}
      </div>
    </div>
  );
  const external = cur.link && /^https?:\/\//.test(cur.link);
  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Annonces et actualités"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn("relative overflow-hidden rounded-2xl border p-3 sm:p-4", dark ? "border-white/15 bg-white/5" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3", className)}
    >
      {cur.link ? (
        external ? (
          <a href={cur.link} target="_blank" rel="noopener noreferrer sponsored" onClick={click} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none">{body}</a>
        ) : (
          <Link href={cur.link} onClick={click} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none">{body}</Link>
        )
      ) : (
        body
      )}
      {n > 1 && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          {list.map((a, k) => (
            <button key={a.id} onClick={() => setI(k)} aria-label={`Annonce ${k + 1} sur ${n}`} aria-current={k === idx} className={cn("h-1.5 rounded-full transition-all duration-300", k === idx ? (dark ? "w-5 bg-white" : "w-5 bg-brand-500") : dark ? "w-1.5 bg-white/40" : "w-1.5 bg-gray-300 dark:bg-gray-600")} />
          ))}
        </div>
      )}
    </section>
  );
}
