"use client";

import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ChevronDownIcon, CloseIcon, CopyIcon, MicrophoneIcon, PaperPlaneIcon, RefreshIcon, SparklesIcon } from "@/icons";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { getRecentPages, installFieldTracker, matchIntents, SUGGESTIONS, trackPageVisit, type IntentAction } from "@/lib/miniMarc";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const DictationPanel = dynamic(() => import("./DictationPanel"), { ssr: false });

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  actions?: IntentAction[];
  /** Message d'erreur : propose une nouvelle tentative. */
  error?: boolean;
}

const WELCOME: ChatMessage = {
  role: "assistant",
  text: "Bonjour, je suis Mini Marc. Je peux (1) discuter et rédiger — reformuler, résumer, préparer des brouillons, (2) transcrire votre voix en texte pour les formulaires (onglet « Dictée »), (3) vous guider vers les pages de la plateforme. Dites-moi ce que vous souhaitez faire.",
};

const TEXT_TOOLS: { label: string; prefix: string }[] = [
  { label: "Reformuler", prefix: "Reformule ce texte, de façon claire et professionnelle : « " },
  { label: "Corriger", prefix: "Corrige l'orthographe et la grammaire de ce texte, sans en changer le sens : « " },
  { label: "Résumer", prefix: "Résume ce texte en quelques phrases : « " },
];

/**
 * Mini Marc — assistant flottant de Cliva.
 * Chat + rédaction : API serveur Gemini (clé côté serveur). Si le service n'est
 * pas configuré, repli transparent sur le moteur d'intentions local (navigation
 * uniquement, clairement identifié).
 * Dictée : transcription serveur + dictée navigateur, insertion contrôlée.
 */
export default function MiniMarc() {
  const { can, db, user } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "dictation">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [recent, setRecent] = useState<{ path: string; label: string }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => installFieldTracker(), []);
  useEffect(() => {
    trackPageVisit(pathname);
    setRecent(getRecentPages().filter((p) => p.path !== pathname));
  }, [pathname]);
  useEffect(() => {
    if (open) setRecent(getRecentPages().filter((p) => p.path !== pathname));
  }, [open, pathname]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  const platform = db.settings.branding?.platformName || DEFAULT_BRANDING.platformName;

  /** Réponse du moteur local (repli sans API ou sans réseau). */
  const localAnswer = (query: string): ChatMessage => {
    const intents = matchIntents(query);
    if (intents.length === 0) {
      return { role: "assistant", text: "Je n'ai pas trouvé de fonction correspondante (mode local — l'IA n'est pas configurée). Essayez « ouvrir la pharmacie », « nouveau patient », « enregistrer une dépense »… ou configurez GEMINI_API_KEY pour le chat complet." };
    }
    const actions = intents
      .flatMap((i) => i.actions)
      .filter((a) => !a.module || can(a.module, "read"))
      .filter((a, i, arr) => arr.findIndex((x) => x.path === a.path) === i);
    if (actions.length === 0) {
      return { role: "assistant", text: "Cette fonction existe, mais votre profil n'y a pas accès. Demandez à votre administrateur de vérifier les permissions." };
    }
    return { role: "assistant", text: intents.map((i) => i.response).join(" "), actions };
  };

  const send = async (query: string) => {
    const q = query.trim();
    if (!q || loading) return;
    setInput("");
    setLastQuery(q);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const history = [...messages.slice(-10), { role: "user" as const, text: q }];
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, text: m.text })), roleId: user?.roleId }),
      });
      const data = (await res.json().catch(() => null)) as {
        reply?: { type: string; text: string };
        action?: { key: string; label: string; path: string } | null;
        error?: { code: string; message: string };
      } | null;
      if (!res.ok || !data?.reply) {
        const code = data?.error?.code;
        const message = data?.error?.message ?? "Le service IA est indisponible. Réessayez.";
        if (code === "not_configured" || code === "model_unavailable") {
          setLocalMode(true);
          setMessages((m) => [...m, { role: "assistant", text: message, error: true }, localAnswer(q)]);
        } else {
          setMessages((m) => [...m, { role: "assistant", text: message, error: true }]);
        }
      } else {
        setLocalMode(false);
        setMessages((m) => [...m, { role: "assistant", text: data.reply!.text, actions: data.action ? [{ label: data.action.label, path: data.action.path }] : undefined }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Impossible de joindre le serveur. Vérifiez votre connexion — le mode local de navigation reste disponible ci-dessous.", error: true }, localAnswer(q)]);
    } finally {
      setLoading(false);
    }
  };

  const applyTool = (prefix: string) => {
    const t = input.trim();
    send(t ? `${prefix}${t} »` : `${prefix.replace(/ « $/, "")} — collez votre texte après les deux points : `);
  };

  return (
    <>
      {/* Fenêtre de discussion */}
      <div
        className={`fixed bottom-24 end-3 z-999 flex w-[calc(100vw-1.5rem)] max-w-sm origin-bottom-right flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl transition-all duration-200 sm:end-5 dark:border-gray-700 dark:bg-gray-900 print:hidden ${
          open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
        role="dialog"
        aria-label="Mini Marc — assistant"
        style={{ height: "min(560px, calc(100vh - 8rem))" }}
      >
        <div className="flex items-center gap-2.5 border-b border-gray-200 bg-brand-500 px-4 py-3 dark:border-gray-700">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white">
            <SparklesIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Mini Marc</p>
            <p className="truncate text-[11px] text-white/75">Assistant {platform}{localMode ? " — mode local (IA non configurée)" : " — chat, dictée, navigation"}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Réduire">
            <ChevronDownIcon className="size-4" />
          </button>
          <button type="button" onClick={() => { setOpen(false); setMessages([WELCOME]); }} className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Fermer et effacer la conversation">
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(["chat", "dictation"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 px-3 py-2 text-sm font-medium transition ${tab === k ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
            >
              {k === "chat" ? "Assistance" : "Dictée vocale"}
            </button>
          ))}
        </div>

        {tab === "dictation" ? (
          <DictationPanel />
        ) : (
          <>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`group flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-brand-500 text-white" : m.error ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"}`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.role === "assistant" && !m.error && (
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(m.text)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-brand-600"
                      >
                        <CopyIcon className="size-3" /> Copier
                      </button>
                    )}
                    {m.error && lastQuery && i === messages.length - 1 && (
                      <button type="button" onClick={() => void send(lastQuery)} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-error-200 px-2 py-0.5 text-[11px] font-medium hover:bg-error-100 dark:border-error-500/30">
                        <RefreshIcon className="size-3" /> Réessayer
                      </button>
                    )}
                    {m.actions && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {m.actions.map((a) => (
                          <button
                            key={a.path}
                            type="button"
                            onClick={() => { setOpen(false); router.push(a.path); }}
                            className="rounded-lg bg-white px-3 py-1.5 text-start text-theme-xs font-medium text-brand-600 shadow-theme-xs transition hover:bg-brand-50 dark:bg-gray-700 dark:text-brand-400 dark:hover:bg-gray-600"
                          >
                            {a.label} →
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100 px-3.5 py-2.5 dark:bg-gray-800" aria-label="Mini Marc réfléchit">
                    {[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d * 150}ms` }} />)}
                  </div>
                </div>
              )}
              {recent.length > 0 && (
                <div>
                  <p className="mb-1.5 text-theme-xs font-medium text-gray-400">Pages récentes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.slice(0, 4).map((p) => (
                      <button key={p.path} type="button" onClick={() => { setOpen(false); router.push(p.path); }} className="rounded-full border border-gray-200 px-2.5 py-1 text-theme-xs text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {input.trim()
                  ? TEXT_TOOLS.map((t) => (
                      <button key={t.label} type="button" onClick={() => applyTool(t.prefix)} disabled={loading} className="rounded-full bg-brand-50 px-2.5 py-1 text-theme-xs font-medium text-brand-600 hover:bg-brand-100 disabled:opacity-40 dark:bg-brand-500/10 dark:text-brand-400">
                        {t.label}
                      </button>
                    ))
                  : SUGGESTIONS.slice(0, 3).map((s) => (
                      <button key={s} type="button" onClick={() => void send(s)} disabled={loading} className="rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                        {s}
                      </button>
                    ))}
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Question, texte à retravailler, navigation…"
                  className="h-10 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-white/90"
                />
                <Button size="sm" type="submit" disabled={!input.trim() || loading} className="shrink-0" startIcon={<PaperPlaneIcon />}>
                  Envoyer
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Bulle flottante */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 end-5 z-999 flex size-13 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-xl transition hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/30 sm:bottom-6 sm:end-6 print:hidden"
        aria-label={open ? "Réduire Mini Marc" : "Ouvrir Mini Marc, l'assistant"}
        aria-expanded={open}
      >
        {open ? <ChevronDownIcon className="size-6" /> : <span className="relative"><SparklesIcon className="size-6" /><MicrophoneIcon className="absolute -bottom-0.5 -end-1 size-3.5 text-white/90" /></span>}
      </button>
    </>
  );
}
