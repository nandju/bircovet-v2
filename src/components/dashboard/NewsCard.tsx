"use client";

import ComponentCard from "@/components/common/ComponentCard";
import { useDemo } from "@/context/DemoStoreContext";
import { formatDate } from "@/lib/format";
import { labelOf } from "@/lib/labels";

/** Veille métier — en démo : exemples hors ligne clairement identifiés (pas de flux temps réel). */
export default function NewsCard() {
  const { db } = useDemo();
  const items = [...db.news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  if (!items.length) return null;
  return (
    <ComponentCard title="Veille et actualités" desc="Sources et dates indiquées — contenu de démonstration non vérifié">
      <ul className="space-y-3">
        {items.map((n) => (
          <li key={n.id}>
            <p className="text-sm font-medium leading-snug text-gray-800 dark:text-white/90">{n.title}</p>
            <p className="mt-0.5 text-theme-xs text-gray-500">{labelOf("news", n.topic)} · {n.source} · {formatDate(n.date)}</p>
            <p className="mt-0.5 line-clamp-2 text-theme-xs text-gray-500 dark:text-gray-400">{n.summary}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-gray-50 px-2.5 py-1.5 text-theme-xs text-gray-400 dark:bg-white/3">
        Flux temps réel : nécessite un connecteur d&apos;actualités (API/RSS) — non activé en démonstration.
      </p>
    </ComponentCard>
  );
}
