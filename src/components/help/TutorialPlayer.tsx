"use client";

import AppModal from "@/components/common/AppModal";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { markTutorialSeen, setTutorialVideo } from "@/lib/services/tutorialsService";
import type { Tutorial } from "@/lib/types";
import { useState } from "react";
import { embedOf } from "./video";

/** Lecteur d'un tutoriel : vidéo intégrée (YouTube / Drive), lien de secours, scénario pour le tournage. */
export default function TutorialPlayer({ t, onClose }: { t: Tutorial | null; onClose: () => void }) {
  const { run, user } = useDemo();
  const [url, setUrl] = useState("");
  const [showScript, setShowScript] = useState(false);
  if (!t) return null;
  const isDG = user?.roleId === "dg";
  const e = embedOf(t.videoUrl);
  const seen = !!user && (t.seenBy ?? []).includes(user.id);
  return (
    <AppModal
      isOpen
      onClose={onClose}
      size="lg"
      title={t.title}
      description={`${t.theme} · ${t.minutes} min · pour : ${t.audience}`}
      footer={
        <>
          <Button size="sm" variant={seen ? "outline" : "primary"} onClick={() => run(markTutorialSeen, { id: t.id, seen: !seen }, { silent: true })}>{seen ? "✓ Vu (marquer à revoir)" : "J'ai regardé ce tutoriel"}</Button>
          <Button size="sm" variant="outline" onClick={onClose}>Fermer</Button>
        </>
      }
    >
      <div className="space-y-4">
        {e ? (
          <div className="space-y-1.5">
            <div className="aspect-video overflow-hidden rounded-2xl bg-gray-900">
              <iframe src={e.src} title={t.title} className="size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
            </div>
            <a href={t.videoUrl} target="_blank" rel="noreferrer" className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400">La vidéo ne s&apos;affiche pas ? L&apos;ouvrir sur {e.host} ↗</a>
          </div>
        ) : t.videoUrl ? (
          <a href={t.videoUrl} target="_blank" rel="noreferrer" className="flex aspect-video items-center justify-center rounded-2xl bg-gray-900 text-white">Ouvrir la vidéo ↗</a>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-white/5">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Vidéo pas encore en ligne</p>
            <p className="max-w-md text-theme-sm text-gray-500">En attendant, suivez les étapes ci-dessous{isDG ? ", ou tournez la vidéo avec le scénario puis collez son lien." : "."}</p>
          </div>
        )}
        {isDG && (
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(ev) => { ev.preventDefault(); if (run(setTutorialVideo, { id: t.id, url }).ok) setUrl(""); }}>
            <input value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder={t.videoUrl ? "Remplacer par un autre lien YouTube ou Drive" : "Coller le lien YouTube ou Google Drive de la vidéo"} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90" aria-label="Lien de la vidéo" />
            <Button size="sm" type="submit" disabled={!url.trim()}>Enregistrer le lien</Button>
          </form>
        )}
        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white/90">Les étapes</h4>
          <ol className="space-y-2">
            {t.script.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">{i + 1}</span>
                <p className="pt-0.5 text-sm text-gray-700 dark:text-gray-300">{s.say}</p>
              </li>
            ))}
          </ol>
        </section>
        {isDG && (
          <section className="rounded-2xl bg-gray-50 p-3 dark:bg-white/5">
            <button type="button" onClick={() => setShowScript(!showScript)} aria-expanded={showScript} className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
              {showScript ? "▾" : "▸"} Scénario de tournage (écran + voix)
            </button>
            {showScript && (
              <table className="mt-2 w-full text-theme-sm">
                <thead><tr className="text-theme-xs text-gray-500"><th className="w-1/3 py-1 text-start font-medium">À l&apos;écran</th><th className="py-1 text-start font-medium">À dire</th></tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {t.script.map((s, i) => <tr key={i} className="align-top"><td className="py-1.5 pe-3 text-gray-600 dark:text-gray-400">{s.show}</td><td className="py-1.5 text-gray-800 dark:text-white/90">« {s.say} »</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </AppModal>
  );
}
