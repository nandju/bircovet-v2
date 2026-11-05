"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDemo } from "@/context/DemoStoreContext";
import { normalize } from "@/lib/format";
import { DEFAULT_TUTORIALS } from "@/lib/tutorials";
import type { Tutorial } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import TutorialPlayer from "./TutorialPlayer";

export function useTutorials(): Tutorial[] {
  const { db } = useDemo();
  return db.tutorials?.length ? db.tutorials : DEFAULT_TUTORIALS;
}

export function TutorialCard({ t, onOpen }: { t: Tutorial; onOpen: () => void }) {
  const { user } = useDemo();
  const seen = !!user && (t.seenBy ?? []).includes(user.id);
  return (
    <li>
      <button type="button" onClick={onOpen} className="cliva-press flex h-full w-full gap-3 rounded-2xl border border-gray-200/70 bg-white p-3 text-start shadow-cliva hover:border-brand-300 dark:border-gray-800 dark:bg-white/3">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl text-xl", t.videoUrl ? "cliva-grad-brand text-white" : "bg-gray-100 text-gray-400 dark:bg-white/10")} aria-hidden>▶</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">{t.title}</span>
          <span className="block text-theme-xs text-gray-500">{t.minutes} min · {t.audience}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {seen && <span className="rounded-full bg-success-50 px-1.5 py-0.5 text-[10px] font-medium text-success-700 dark:bg-success-500/15 dark:text-success-300">✓ Vu</span>}
            {!t.videoUrl && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-white/10">vidéo à venir · étapes écrites</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function HelpCenter() {
  const { user } = useDemo();
  const list = useTutorials();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const t = normalize(q);
  const shown = list.filter((x) => !t || normalize(`${x.title} ${x.theme} ${x.script.map((s) => s.say).join(" ")}`).includes(t));
  const themes = [...new Set(shown.map((x) => x.theme))];
  const seen = list.filter((x) => user && (x.seenBy ?? []).includes(user.id)).length;
  const online = list.filter((x) => x.videoUrl).length;
  const current = list.find((x) => x.id === open) ?? null;
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Centre d'aide" subtitle="Des tutoriels courts pour prendre l'application en main" />
      <div className="cliva-grad-brand cliva-glow flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 text-white">
        <div>
          <p className="text-lg font-semibold">Vous avez regardé {seen} tutoriel(s) sur {list.length}</p>
          <p className="text-theme-sm text-white/85">Commencez par « Prise en main de Cliva » (3 minutes).</p>
        </div>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={seen} aria-valuemin={0} aria-valuemax={list.length} aria-label="Progression">
          <div className="h-full rounded-full bg-white" style={{ width: `${(seen / Math.max(1, list.length)) * 100}%` }} />
        </div>
      </div>
      {user?.roleId === "dg" && (
        <p className="rounded-2xl border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-theme-sm text-blue-light-800 dark:border-blue-light-500/30 dark:bg-blue-light-500/10 dark:text-blue-light-300">
          <strong>{online} vidéo(s) en ligne sur {list.length}.</strong> Ouvrez un tutoriel pour lire son scénario de tournage, puis collez le lien de la vidéo (YouTube « non répertoriée » ou Google Drive partagé « Tous les utilisateurs disposant du lien »).
        </p>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Que cherchez-vous ? (ex. : vente, rendez-vous, dépense…)" aria-label="Rechercher un tutoriel" className="h-12 w-full rounded-2xl border border-gray-300 bg-white px-4 text-base text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" />
      {themes.map((th) => (
        <section key={th}>
          <h3 className="mb-2 text-base font-semibold text-gray-800 dark:text-white/90">{th}</h3>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.filter((x) => x.theme === th).map((x) => <TutorialCard key={x.id} t={x} onOpen={() => setOpen(x.id)} />)}
          </ul>
        </section>
      ))}
      {!shown.length && <p className="text-center text-sm text-gray-500">Aucun tutoriel ne correspond.</p>}
      <TutorialPlayer t={current} onClose={() => setOpen(null)} />
    </div>
  );
}
