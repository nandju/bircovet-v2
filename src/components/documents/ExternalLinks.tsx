"use client";

import { TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { userName } from "@/lib/calc";
import { formatDate } from "@/lib/format";
import { linkKind } from "@/lib/protocols";
import { addExternalLink, removeExternalLink } from "@/lib/services/protocolsService";
import type { ExternalLink } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

/** Liens de redirection d'un dossier : Google Drive, Docs, Sheets, Maps, vidéos… */
export default function ExternalLinks({ refTo, title = "Liens (Google Drive, Docs, Sheets, Maps…)" }: { refTo: ExternalLink["ref"]; title?: string }) {
  const { db, run } = useDemo();
  const [v, setV] = useState({ label: "", url: "" });
  const [open, setOpen] = useState(false);
  const list = (db.links ?? []).filter((l) => l.ref.kind === refTo.kind && l.ref.id === refTo.id);
  return (
    <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
        <Button size="xs" variant="soft" onClick={() => setOpen((o) => !o)}>{open ? "Fermer" : "+ Ajouter un lien"}</Button>
      </div>
      {open && (
        <form
          className="cliva-fade mt-2 grid grid-cols-1 items-end gap-2 sm:grid-cols-[12rem_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (run(addExternalLink, { ref: refTo, ...v }).ok) {
              setV({ label: "", url: "" });
              setOpen(false);
            }
          }}
        >
          <TextField label="Nom" value={v.label} onChange={(x) => setV({ ...v, label: x })} placeholder="Ex. : Bilan sanguin, plan de la ferme" />
          <TextField label="Lien" value={v.url} onChange={(x) => setV({ ...v, url: x, label: v.label || (x ? linkKind(x).label : "") })} placeholder="https://drive.google.com/…" />
          <Button size="sm" type="submit">Ajouter</Button>
        </form>
      )}
      {list.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {list.map((l) => (
            <li key={l.id} className="group flex items-center gap-1 rounded-full border border-gray-200 py-0.5 ps-1 pe-2 dark:border-gray-700">
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", linkKind(l.url).tone)}>{linkKind(l.url).label}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" title={`Ajouté par ${userName(db, l.addedById)} le ${formatDate(l.addedAt)}`} className="text-theme-xs font-medium text-gray-800 hover:underline dark:text-white/90">{l.label} ↗</a>
              <button type="button" aria-label={`Retirer ${l.label}`} onClick={() => run(removeExternalLink, { id: l.id })} className="ms-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-error-600 focus:opacity-100">✕</button>
            </li>
          ))}
        </ul>
      ) : (
        !open && <p className="mt-1 text-theme-xs text-gray-500">Aucun lien. Collez un lien de partage Google (Drive, Docs, Sheets, Maps) pour l&apos;ouvrir d&apos;un clic.</p>
      )}
    </div>
  );
}
