"use client";

import Button from "@/components/ui/button/Button";
import { CloseLineIcon, CopyIcon, MicrophoneIcon, RefreshIcon } from "@/icons";
import { getTargetField, describeTarget, insertIntoTarget, type InsertionResult } from "@/lib/miniMarc";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Onglet « Dictée » de Mini Marc : transcription vocale via l'API Web Speech
 * du navigateur (aucune donnée transmise par l'application). L'import d'un
 * fichier audio nécessite un service de transcription externe (ex. Whisper) —
 * le point d'intégration est documenté ci-dessous, pas de fausse fonctionnalité.
 */
export default function DictationPanel() {
  const supported = getSpeechRecognition() !== null;
  const recRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [undoInsert, setUndoInsert] = useState<(() => void) | null>(null);

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  useEffect(() => () => recRef.current?.abort(), []);

  const start = () => {
    setError("");
    setNotice("");
    const Ctor = getSpeechRecognition();
    if (!Ctor) return setError("La dictée vocale n'est pas prise en charge par ce navigateur (Chrome, Edge ou Safari requis).");
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) setText((t) => (t ? `${t} ${e.results[i][0].transcript.trim()}` : e.results[i][0].transcript.trim()));
      }
    };
    rec.onerror = (e) => {
      setListening(false);
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Accès au microphone refusé. Autorisez le microphone dans les paramètres du navigateur, puis réessayez."
          : e.error === "no-speech"
            ? "Aucune voix détectée. Rapprochez-vous du micro et réessayez."
            : `Erreur de dictée : ${e.error}`
      );
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Impossible de démarrer la dictée vocale.");
    }
  };

  const insert = (mode: "append" | "replace") => {
    const res: InsertionResult = insertIntoTarget(text, mode);
    setNotice(res.message);
    if (res.ok && res.undo) setUndoInsert(() => res.undo!);
  };

  const target = typeof document !== "undefined" ? getTargetField() : null;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        Dictez, relisez, puis insérez le texte dans un champ : cliquez d&apos;abord dans le champ du formulaire (anamnèse, examen clinique, plan de soins, rapport de visite…), puis choisissez « Ajouter » ou « Remplacer ». La transcription est fidèle à vos propos — elle ne remplace ni le jugement clinique ni la validation du vétérinaire.
      </p>

      {!supported && (
        <div className="rounded-lg bg-warning-50 px-3 py-2 text-theme-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          Ce navigateur ne propose pas la dictée vocale intégrée. Vous pouvez saisir ou coller le texte manuellement ci-dessous.
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported}
          className={`flex size-11 items-center justify-center rounded-full text-white shadow-theme-md transition disabled:opacity-40 ${listening ? "animate-pulse bg-error-500" : "bg-brand-500 hover:bg-brand-600"}`}
          aria-label={listening ? "Arrêter la dictée" : "Démarrer la dictée"}
        >
          <MicrophoneIcon className="size-5" />
        </button>
        <span className="text-theme-sm text-gray-600 dark:text-gray-300">{listening ? "Écoute en cours… parlez, puis appuyez pour arrêter." : "Appuyez pour dicter."}</span>
      </div>
      {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-theme-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">{error}</p>}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="minimarc-transcript" className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">Aperçu du texte (modifiable)</label>
          <div className="flex gap-1">
            <button type="button" onClick={() => { setText(""); setUndoInsert(null); setNotice(""); }} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10" aria-label="Effacer" title="Effacer"><CloseLineIcon className="size-4" /></button>
            <button type="button" onClick={stop} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10" aria-label="Recommencer" title="Recommencer"><RefreshIcon className="size-4" /></button>
          </div>
        </div>
        <textarea
          id="minimarc-transcript"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Le texte dicté apparaîtra ici…"
          className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" startIcon={<CopyIcon />} onClick={() => { void navigator.clipboard?.writeText(text); setNotice("Texte copié dans le presse-papiers."); }} disabled={!text.trim()}>Copier</Button>
        <Button size="sm" onClick={() => insert("append")} disabled={!text.trim()}>Ajouter au champ</Button>
        <Button size="sm" variant="outline" onClick={() => insert("replace")} disabled={!text.trim()}>Remplacer le champ</Button>
        {undoInsert && <Button size="sm" variant="outline" onClick={() => { undoInsert(); setUndoInsert(null); setNotice("Insertion annulée."); }}>Annuler l&apos;insertion</Button>}
      </div>
      {notice && <p className="rounded-lg bg-brand-50 px-3 py-2 text-theme-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">{notice}</p>}
      <p className="text-theme-xs text-gray-400">
        Champ ciblé : {target ? describeTarget(target) : "aucun — cliquez dans un champ de texte du formulaire avant d'insérer."}
      </p>

      <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700">
        <label className="block cursor-pointer text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          Importer un fichier audio…
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && setError("La transcription de fichiers audio nécessite un service externe (ex. API Whisper) — non configuré dans cette démonstration. Elle sera activée via une variable d'environnement côté serveur, sans quitter l'application.")} />
        </label>
        <p className="mt-1 text-theme-xs text-gray-400">Prévu — nécessite une clé API de transcription côté serveur (aucun fichier n&apos;est envoyé aujourd&apos;hui).</p>
      </div>
    </div>
  );
}
