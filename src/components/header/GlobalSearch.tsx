"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useRouter } from "@/i18n/navigation";
import { SearchIcon } from "@/icons";
import { clientName } from "@/lib/calc";
import { normalize } from "@/lib/format";
import { cn } from "@/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Hit {
  group: string;
  label: string;
  sub: string;
  href: string;
}

/** Recherche globale (Ctrl/⌘ + K) sur les données accessibles au profil. */
export default function GlobalSearch({ className }: { className?: string }) {
  const { db, can, user } = useDemo();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, close);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = normalize(q);
    if (term.length < 2) return [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x && normalize(x).includes(term));
    const out: Hit[] = [];
    const shared = user?.roleId === "confrere" ? new Set(user.sharedPatientIds ?? []) : null;
    if (can("clients")) db.clients.filter((c) => has(c.name, c.code, c.phone, c.email)).slice(0, 5).forEach((c) => out.push({ group: "Clients", label: c.name, sub: `${c.code} · ${c.phoneCode} ${c.phone}`, href: `/clients/${c.id}` }));
    if (can("patients"))
      db.patients
        .filter((p) => (!shared || shared.has(p.id)) && has(p.name, p.code, p.chip, p.breed))
        .slice(0, 5)
        .forEach((p) => out.push({ group: "Patients", label: p.name, sub: `${p.code} · ${p.species} · ${clientName(db, p.ownerId)}`, href: `/patients/${p.id}` }));
    if (can("facturation")) db.invoices.filter((i) => has(i.code, i.payerName)).slice(0, 4).forEach((i) => out.push({ group: "Factures", label: i.code, sub: i.payerName, href: `/facturation/factures/${i.id}` }));
    if (can("consultations") && !shared) db.consultations.filter((c) => has(c.code, c.reason)).slice(0, 4).forEach((c) => out.push({ group: "Consultations", label: c.code, sub: c.reason, href: `/consultations/${c.id}` }));
    if (can("stock")) db.products.filter((p) => has(p.name, p.code)).slice(0, 4).forEach((p) => out.push({ group: "Articles", label: p.name, sub: p.code, href: `/stock/articles/${p.id}` }));
    if (can("exploitations")) db.farms.filter((f) => has(f.name, f.code, f.location)).slice(0, 3).forEach((f) => out.push({ group: "Exploitations", label: f.name, sub: `${f.code} · ${f.location}`, href: `/exploitations/${f.id}` }));
    return out;
  }, [q, db, can, user]);

  const go = (h: Hit) => {
    router.push(h.href);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, hits.length - 1));
          if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
          if (e.key === "Enter" && hits[idx]) go(hits[idx]);
          if (e.key === "Escape") close();
        }}
        placeholder="Rechercher un client, patient, facture…"
        aria-label="Recherche globale"
        className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 ps-12 pe-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden xl:w-96 2xl:w-107.5 dark:border-gray-800 dark:bg-white/3 dark:text-white/90 dark:placeholder:text-white/30"
      />
      <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500 sm:block dark:border-gray-800 dark:bg-white/3 dark:text-gray-400">Ctrl K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="custom-scrollbar absolute inset-x-0 top-full z-99999 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-500">Aucun résultat pour « {q} »</p>
          ) : (
            hits.map((h, i) => (
              <div key={h.href}>
                {(i === 0 || hits[i - 1].group !== h.group) && <p className="px-3 pt-2 pb-1 text-theme-xs font-medium text-gray-400 uppercase">{h.group}</p>}
                <button onMouseEnter={() => setIdx(i)} onClick={() => go(h)} className={cn("block w-full rounded-lg px-3 py-2 text-start", i === idx ? "bg-brand-25 dark:bg-white/5" : "")}>
                  <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">{h.label}</span>
                  <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">{h.sub}</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
