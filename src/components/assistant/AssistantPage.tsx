"use client";

import DemoNotice from "@/components/common/DemoNotice";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useToast } from "@/context/ToastContext";
import { Link } from "@/i18n/navigation";
import { CopyIcon, PaperPlaneIcon, PlusIcon, SparklesIcon, TrashBinIcon } from "@/icons";
import { formatDateTime } from "@/lib/format";
import { AI_DISCLAIMER, AI_SUGGESTIONS, askAssistant, deleteConversation, setDraftStatus } from "@/lib/services/aiService";
import type { AIMessage } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useRef, useState } from "react";

/** Assistant IA SIMULÉ : réponses issues de scénarios locaux, toujours présentées comme brouillons. */
export default function AssistantPage() {
  const { db, run } = useDemo();
  const toast = useToast();
  const [convId, setConvId] = useState<string | undefined>(db.aiConversations[0]?.id);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conv = db.aiConversations.find((c) => c.id === convId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv?.messages.length, loading]);

  const send = (text = prompt) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setPrompt("");
    setTimeout(() => {
      const r = run(askAssistant, { conversationId: convId, prompt: text }, { silent: true });
      if (r.ok && r.data) setConvId(r.data);
      setLoading(false);
    }, 700);
  };

  const status = (m: AIMessage, s: NonNullable<AIMessage["draftStatus"]>, content?: string) => conv && run(setDraftStatus, { conversationId: conv.id, messageId: m.id, status: s, content });

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Assistant IA" subtitle="Simulation frontend — aucun modèle d'IA réel n'est appelé" />
      <DemoNotice tone="warning">
        L&apos;assistant ne décide jamais d&apos;un diagnostic, n&apos;invente ni dose ni prescription, n&apos;autorise aucune délivrance, ne modifie pas le stock, ne valide pas de facture, n&apos;autorise pas de crédit, n&apos;envoie aucun message et ne modifie pas le statut vital. Accepter un brouillon ne contourne aucune validation.
      </DemoNotice>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/3">
          <Button size="sm" className="w-full" startIcon={<PlusIcon />} onClick={() => setConvId(undefined)}>Nouvelle conversation</Button>
          <p className="px-1 text-theme-xs font-medium text-gray-400 uppercase">Historique (fictif)</p>
          <ul className="custom-scrollbar max-h-72 space-y-1 overflow-y-auto lg:max-h-[50vh]">
            {db.aiConversations.map((c) => (
              <li key={c.id} className={cn("group flex items-center gap-1 rounded-lg", convId === c.id && "bg-brand-25 dark:bg-brand-500/10")}>
                <button onClick={() => setConvId(c.id)} className="min-w-0 flex-1 px-2 py-2 text-start">
                  <span className="block truncate text-sm text-gray-800 dark:text-white/90">{c.title}</span>
                  <span className="block text-[11px] text-gray-400">{formatDateTime(c.date)}</span>
                </button>
                <button onClick={() => { run(deleteConversation, { id: c.id }, { silent: true }); if (convId === c.id) setConvId(undefined); }} className="p-2 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-error-500 focus:opacity-100" aria-label="Supprimer la conversation">
                  <TrashBinIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[60vh] flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {!conv?.messages.length && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 [&>svg]:size-6"><SparklesIcon /></span>
                <p className="font-medium text-gray-800 dark:text-white/90">Comment puis-je aider ?</p>
                <p className="mt-1 max-w-md text-sm text-gray-500">Choisissez une suggestion ou posez une question sur les données fictives.</p>
              </div>
            )}
            {conv?.messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ms-auto max-w-[85%] rounded-2xl rounded-ee-sm bg-brand-500 px-4 py-2.5 text-sm text-white">{m.content}</div>
              ) : (
                <div key={m.id} className="max-w-[92%] rounded-2xl rounded-es-sm border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <SparklesIcon className="size-4 text-brand-500" />
                    <span className="text-theme-xs font-medium text-gray-500">Assistant simulé</span>
                    {m.draftStatus && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", m.draftStatus === "rejete" ? "bg-gray-200 text-gray-500 dark:bg-white/10" : m.draftStatus === "accepte" ? "bg-success-50 text-success-700 dark:bg-success-500/15" : "bg-warning-50 text-warning-700 dark:bg-warning-500/15")}>
                        {AI_DISCLAIMER}{m.draftStatus === "accepte" ? " · accepté comme texte de travail" : m.draftStatus === "rejete" ? " · rejeté" : m.draftStatus === "modifie" ? " · modifié" : ""}
                      </span>
                    )}
                  </div>
                  {editing?.id === m.id ? (
                    <div className="space-y-2">
                      <TextArea value={editing.text} onChange={(text) => setEditing({ id: m.id, text })} rows={8} />
                      <div className="flex gap-2">
                        <Button size="xs" onClick={() => { status(m, "modifie", editing.text); setEditing(null); }}>Enregistrer le brouillon</Button>
                        <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
                      </div>
                    </div>
                  ) : (
                    <p className={cn("text-sm whitespace-pre-wrap text-gray-800 dark:text-white/90", m.draftStatus === "rejete" && "opacity-50")}>{m.content}</p>
                  )}
                  {!!m.references?.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.references.map((r) => (r.href ? <Link key={r.label} href={r.href} className="rounded-full border border-tertiary-200 bg-tertiary-25 px-2 py-0.5 text-[11px] text-tertiary-700 hover:underline dark:border-tertiary-800 dark:bg-tertiary-500/10 dark:text-tertiary-300">{r.label}</Link> : <span key={r.label} className="rounded-full border px-2 py-0.5 text-[11px]">{r.label}</span>))}
                    </div>
                  )}
                  {m.draftStatus && m.draftStatus !== "rejete" && editing?.id !== m.id && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="xs" variant="outline" startIcon={<CopyIcon />} onClick={() => { navigator.clipboard?.writeText(m.content); toast.show("info", "Brouillon copié dans le presse-papiers."); }}>Copier</Button>
                      <Button size="xs" variant="outline" onClick={() => setEditing({ id: m.id, text: m.content })}>Modifier le brouillon</Button>
                      {m.draftStatus !== "accepte" && <Button size="xs" variant="soft" onClick={() => status(m, "accepte")}>Accepter le brouillon</Button>}
                      <Button size="xs" variant="ghost" className="text-error-600" onClick={() => status(m, "rejete")}>Rejeter</Button>
                    </div>
                  )}
                </div>
              ),
            )}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => <span key={i} className="size-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i * 120}ms` }} />)}
                </span>
                Préparation d&apos;un brouillon…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-gray-100 p-3 dark:border-gray-800">
            <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
              {AI_SUGGESTIONS.map((s) => (
                <button key={s.label} onClick={() => send(s.prompt)} className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-theme-xs text-gray-600 hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:text-gray-400">{s.label}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
              <div className="flex-1">
                <TextArea value={prompt} onChange={setPrompt} rows={2} placeholder="Ex. « Résume la consultation CONS-0005 » ou « Signale les anomalies administratives »" />
              </div>
              <Button type="submit" disabled={!prompt.trim() || loading} className="mb-0.5" startIcon={<PaperPlaneIcon />}>Envoyer</Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
