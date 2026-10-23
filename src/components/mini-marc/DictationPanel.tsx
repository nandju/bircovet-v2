"use client";

import Button from "@/components/ui/button/Button";
import { CloseLineIcon, CopyIcon, MicrophoneIcon, RefreshIcon } from "@/icons";
import { describeTarget, getTargetField, insertIntoTarget, type InsertionResult } from "@/lib/miniMarc";
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

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // aligné sur la limite serveur
const MAX_RECORD_SECONDS = 180; // arrêt automatique — protège le quota
const ACCEPTED_AUDIO = "audio/webm,audio/ogg,audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/x-m4a,audio/wav,audio/x-wav,audio/flac,audio/aac";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Onglet « Dictée » de Mini Marc.
 * - Enregistrement micro → transcription réelle via /api/assistant/transcribe
 *   (Gemini côté serveur, fichier traité en mémoire, jamais conservé).
 * - Import d'un fichier audio via le même service.
 * - Repli sans serveur : dictée Web Speech du navigateur ou saisie manuelle.
 * - Insertion contrôlée et annulable dans le champ ciblé — jamais silencieuse.
 */
export default function DictationPanel() {
  const speechSupported = getSpeechRecognition() !== null;
  const recorderSupported = typeof window !== "undefined" && "MediaRecorder" in window;
  const recRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recorded, setRecorded] = useState<{ blob: Blob; url: string } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [serverUnavailable, setServerUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [undoInsert, setUndoInsert] = useState<(() => void) | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };
  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(
    () => () => {
      recRef.current?.abort();
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
      cleanupStream();
      stopTimer();
      if (recorded?.url) URL.revokeObjectURL(recorded.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* -------------------- Dictée directe navigateur (repli) -------------------- */

  const stopSpeech = () => {
    recRef.current?.stop();
    setListening(false);
  };

  const startSpeech = () => {
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

  /* ------------------- Enregistrement → transcription serveur ------------------- */

  const startRecording = async () => {
    setError("");
    setNotice("");
    if (!recorderSupported) return setError("L'enregistrement audio n'est pas pris en charge par ce navigateur. Utilisez la dictée directe ou la saisie.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        cleanupStream();
        stopTimer();
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return setError("L'enregistrement est vide. Réessayez en parlant plus près du micro.");
        setRecorded((old) => {
          if (old?.url) URL.revokeObjectURL(old.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      };
      mediaRef.current = rec;
      rec.start(500);
      setRecorded(null);
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) stopRecording();
          return s + 1;
        });
      }, 1_000);
    } catch (e) {
      setError(
        (e as DOMException)?.name === "NotAllowedError"
          ? "Accès au microphone refusé. Autorisez le microphone dans les paramètres du navigateur, puis réessayez."
          : "Impossible d'accéder au microphone de cet appareil."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.onstop = () => undefined;
      mediaRef.current.stop();
    }
    cleanupStream();
    stopTimer();
    setRecording(false);
    setElapsed(0);
    setNotice("Enregistrement annulé — aucun fichier envoyé.");
  };

  const discardRecorded = () => {
    if (recorded?.url) URL.revokeObjectURL(recorded.url);
    setRecorded(null);
  };

  /** Envoie l'audio au service de transcription sécurisé. */
  const transcribe = async (blob: Blob, filename: string) => {
    setError("");
    setNotice("");
    if (blob.size > MAX_AUDIO_BYTES) return setError("Le fichier audio dépasse 15 Mo. Enregistrez plus court ou choisissez un fichier plus léger.");
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, filename);
      const res = await fetch("/api/assistant/transcribe", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: { code?: string; message?: string } } | null;
      if (!res.ok || typeof data?.text !== "string") {
        const code = data?.error?.code;
        if (code === "not_configured" || code === "model_unavailable") setServerUnavailable(true);
        setError(data?.error?.message ?? "La transcription a échoué. Réessayez.");
        return;
      }
      setText(data.text);
      setNotice("Transcription terminée — relisez et corrigez le texte avant insertion.");
      discardRecorded();
    } catch {
      setError("Impossible de joindre le serveur de transcription. Vérifiez votre connexion — la dictée du navigateur reste disponible.");
    } finally {
      setTranscribing(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const mime = file.type.split(";")[0].toLowerCase();
    if (!ACCEPTED_AUDIO.includes(mime)) return setError("Format non pris en charge (acceptés : WebM, OGG, MP3, M4A/MP4, WAV, FLAC, AAC).");
    if (file.size > MAX_AUDIO_BYTES) return setError("Fichier trop volumineux : 15 Mo maximum.");
    void transcribe(file, file.name);
  };

  /* ------------------------------- Insertion ------------------------------- */

  const insert = (mode: "append" | "replace") => {
    const res: InsertionResult = insertIntoTarget(text, mode);
    setNotice(res.message);
    if (res.ok && res.undo) setUndoInsert(() => res.undo!);
  };

  const target = typeof document !== "undefined" ? getTargetField() : null;
  const busy = transcribing || recording || listening;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        Deux modes : <strong>enregistrer un fichier audio</strong> (réécoutable, transcrit par Gemini — plus précis, accepte aussi un fichier importé) ou <strong>dicter en direct</strong> (reconnaissance du navigateur, instantanée). Relisez puis insérez dans un champ : cliquez d&apos;abord dans le champ du formulaire (anamnèse, examen clinique, plan de soins, rapport de visite…), puis « Ajouter » ou « Remplacer ». La transcription n&apos;est pas une validation médicale.
      </p>

      {/* Enregistrement → serveur */}
      <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <p className="mb-2 text-theme-xs font-semibold text-gray-700 dark:text-gray-300">Enregistrer puis transcrire <span className="font-normal text-gray-400">(fichier + serveur Gemini — plus précis)</span></p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recording ? stopRecording : () => void startRecording()}
            disabled={!recorderSupported || transcribing || listening}
            className={`flex size-11 items-center justify-center rounded-full text-white shadow-theme-md transition disabled:opacity-40 ${recording ? "animate-pulse bg-error-500" : "bg-brand-500 hover:bg-brand-600"}`}
            aria-label={recording ? "Arrêter l'enregistrement" : "Enregistrer un message"}
          >
            <MicrophoneIcon className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-theme-sm text-gray-600 dark:text-gray-300">
            {recording ? (
              <span>Enregistrement… <strong>{fmt(elapsed)}</strong> <span className="text-theme-xs text-gray-400">(max {fmt(MAX_RECORD_SECONDS)})</span></span>
            ) : recorded ? (
              <span>Enregistrement prêt ({(recorded.blob.size / 1024).toFixed(0)} Ko).</span>
            ) : (
              <span>Appuyez pour enregistrer, puis transcribez.</span>
            )}
          </div>
          {recording && (
            <button type="button" onClick={cancelRecording} className="rounded-lg border border-gray-300 px-2 py-1 text-theme-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700" aria-label="Annuler l'enregistrement">
              Annuler
            </button>
          )}
        </div>
        {recorded && !recording && (
          <div className="mt-2 space-y-2">
            {/* Enregistrement créé localement par l'utilisateur — pas de sous-titres. */}
            <audio controls src={recorded.url} className="h-9 w-full" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void transcribe(recorded.blob, "dictee.webm")} disabled={transcribing}>{transcribing ? "Transcription…" : "Transcrire"}</Button>
              <Button size="sm" variant="outline" onClick={discardRecorded} disabled={transcribing}>Recommencer</Button>
            </div>
          </div>
        )}
        {transcribing && <p className="mt-2 text-theme-xs text-gray-500">Transcription en cours — l&apos;audio est traité en mémoire et n&apos;est pas conservé…</p>}
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <label className="block cursor-pointer text-theme-xs font-medium text-gray-500 hover:text-brand-600 dark:text-gray-400">
            …ou importer un fichier audio
            <input type="file" accept={ACCEPTED_AUDIO} className="hidden" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="text-theme-xs text-gray-400">WebM, OGG, MP3, M4A, WAV, FLAC, AAC — 15 Mo max.</p>
        </div>
      </div>

      {/* Repli navigateur */}
      <div className="rounded-xl border border-dashed border-gray-200 p-3 dark:border-gray-700">
        <p className="mb-2 text-theme-xs font-semibold text-gray-700 dark:text-gray-300">Dictée directe <span className="font-normal text-gray-400">(texte en direct — navigateur{serverUnavailable ? ", repli : serveur non configuré" : ", sans serveur"})</span></p>
        {speechSupported ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={listening ? stopSpeech : startSpeech}
              disabled={recording || transcribing}
              className={`flex size-9 items-center justify-center rounded-full text-white shadow-theme-sm transition disabled:opacity-40 ${listening ? "animate-pulse bg-error-500" : "bg-secondary-500 hover:bg-secondary-600"}`}
              aria-label={listening ? "Arrêter la dictée" : "Démarrer la dictée"}
            >
              <MicrophoneIcon className="size-4" />
            </button>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">{listening ? "Écoute en cours…" : "Transcription en direct dans la zone de texte."}</span>
          </div>
        ) : (
          <p className="text-theme-xs text-gray-400">Dictée navigateur non prise en charge ici — utilisez l&apos;enregistrement ci-dessus ou la saisie manuelle.</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-error-50 px-3 py-2 text-theme-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">
          <p>{error}</p>
          {serverUnavailable && <p className="mt-1 text-gray-500 dark:text-gray-400">La dictée du navigateur ci-dessus fonctionne sans serveur.</p>}
        </div>
      )}

      {/* Aperçu + insertion */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="minimarc-transcript" className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">Aperçu du texte (modifiable)</label>
          <div className="flex gap-1">
            <button type="button" onClick={() => { setText(""); setUndoInsert(null); setNotice(""); }} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10" aria-label="Effacer" title="Effacer"><CloseLineIcon className="size-4" /></button>
            <button type="button" onClick={() => { stopSpeech(); setText(""); }} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10" aria-label="Recommencer" title="Recommencer"><RefreshIcon className="size-4" /></button>
          </div>
        </div>
        <textarea
          id="minimarc-transcript"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Le texte transcrit apparaîtra ici…"
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
    </div>
  );
}
