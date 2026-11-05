"use client";

import Button from "@/components/ui/button/Button";
import { compressImage } from "@/utils/image";
import { useState } from "react";

export type DraftLink = { label: string; url: string };
export type DraftPhoto = { name: string; dataUrl: string };

const isUrl = (u: string) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(u.trim());

/** Ajout de photos (caméra ou fichiers) et de liens Drive, avant ou après l'enregistrement. */
export function useProofInputs(onPhoto: (p: DraftPhoto) => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const onFiles = async (files: FileList | null) => {
    setErr("");
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      try {
        onPhoto({ name: f.name || "Photo facture", dataUrl: await compressImage(f, 1400, 0.7) });
      } catch {
        setErr("Seules les images sont acceptées en photo. Pour un PDF, mettez-le sur Drive et collez le lien.");
      }
    }
    setBusy(false);
  };
  return { busy, err, onFiles };
}

export function PhotoButtons({ onFiles, busy, disabled }: { onFiles: (f: FileList | null) => void; busy: boolean; disabled?: boolean }) {
  const cls = "cliva-press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-theme-sm font-medium text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300";
  return (
    <div className="flex flex-wrap gap-2">
      <label className={cls} aria-disabled={disabled}>
        Prendre en photo
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <label className={cls} aria-disabled={disabled}>
        Choisir des images
        <input type="file" accept="image/*" multiple className="sr-only" disabled={disabled} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      {busy && <span className="self-center text-theme-xs text-gray-500">Compression…</span>}
    </div>
  );
}

export function LinkAdder({ onAdd }: { onAdd: (l: DraftLink) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const bad = url.trim() !== "" && !isUrl(url);
  const add = () => {
    if (!isUrl(url)) return;
    onAdd({ label: label.trim() || "Facture (Drive)", url: url.trim() });
    setLabel("");
    setUrl("");
  };
  const input = "h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90";
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (facture, reçu…)" aria-label="Libellé du lien" />
        <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="https://drive.google.com/…" aria-label="Lien Drive" />
        <Button size="sm" variant="soft" onClick={add} disabled={!isUrl(url)}>Ajouter le lien</Button>
      </div>
      {bad && <p className="mt-1 text-theme-xs text-error-500">Collez le lien de partage complet (il commence par https://).</p>}
    </div>
  );
}

/** Vignettes de photos, avec agrandissement au clic. */
export function PhotoStrip({ photos, onRemove }: { photos: { id?: string; name: string; dataUrl: string }[]; onRemove?: (index: number) => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id ?? i} className="relative">
            <button type="button" onClick={() => setZoom(p.dataUrl)} className="block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" title={p.name}>
              {/* eslint-disable-next-line @next/next/no-img-element -- photo locale */}
              <img src={p.dataUrl} alt={p.name} className="size-20 object-cover" />
            </button>
            {onRemove && (
              <button type="button" onClick={() => onRemove(i)} aria-label={`Retirer ${p.name}`} className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-gray-900 text-[11px] text-white">
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {zoom && (
        <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-[100002] flex items-center justify-center bg-gray-900/80 p-4" aria-label="Fermer l'aperçu">
          {/* eslint-disable-next-line @next/next/no-img-element -- photo locale */}
          <img src={zoom} alt="Facture" className="max-h-full max-w-full rounded-lg" />
        </button>
      )}
    </>
  );
}

export function LinkList({ links, onRemove }: { links: { id?: string; label: string; url: string }[]; onRemove?: (index: number) => void }) {
  if (!links.length) return null;
  return (
    <ul className="space-y-1">
      {links.map((l, i) => (
        <li key={l.id ?? i} className="flex items-center gap-2 text-sm">
          <span className="rounded bg-blue-light-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-300">DRIVE</span>
          <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-600 hover:underline dark:text-brand-400">{l.label}</a>
          {onRemove && <button type="button" onClick={() => onRemove(i)} className="text-theme-xs text-gray-500 hover:text-error-600">Retirer</button>}
        </li>
      ))}
    </ul>
  );
}
