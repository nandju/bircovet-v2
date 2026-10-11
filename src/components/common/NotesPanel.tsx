"use client";

import StatusBadge from "@/components/common/StatusBadge";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { userName } from "@/lib/calc";
import { formatDateTime } from "@/lib/format";
import type { Note } from "@/lib/types";
import { useState } from "react";

/** Notes et suivis datés ; en mode hors ligne, la note est marquée « en attente de synchronisation ». */
export default function NotesPanel({ notes, onAdd, canAdd = true }: { notes: Note[]; onAdd: (text: string) => boolean; canAdd?: boolean }) {
  const { db, session } = useDemo();
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      {canAdd && (
        <div className="space-y-2">
          <TextArea value={text} onChange={setText} rows={3} placeholder={session.offline ? "Note saisie hors ligne (simulation) — sera mise en file de synchronisation" : "Ajouter une note de suivi…"} />
          <div className="flex justify-end">
            <Button size="sm" disabled={!text.trim()} onClick={() => onAdd(text) && setText("")}>
              Ajouter la note
            </Button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune note.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-white/2">
              <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-white/90">{n.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-theme-xs text-gray-500">
                {userName(db, n.authorId)} · {formatDateTime(n.date)}
                {n.syncStatus && n.syncStatus !== "synchronise" && <StatusBadge kind="sync" value={n.syncStatus} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
