import { GoogleGenAI } from "@google/genai";
import { catalogForModel, isKnownActionKey } from "./actions";
import type { RoleId } from "../types";

/**
 * Accès serveur à Google Gemini pour Mini Marc.
 * ⚠️ Serveur uniquement — la clé API ne quitte jamais ce module et n'est
 * jamais exposée dans les réponses, les erreurs ou les journaux.
 *
 * Configuration (variables d'environnement) :
 *   GEMINI_API_KEY           — requise (https://aistudio.google.com/apikey)
 *   GEMINI_MODEL             — défaut : gemini-3.5-flash-lite (offre gratuite)
 *   GEMINI_TRANSCRIBE_MODEL  — défaut : gemini-3.5-transcribe (STT dédié, offre
 *                              gratuite ; repli automatique sur GEMINI_MODEL si
 *                              le modèle STT est indisponible pour le compte).
 */

export const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe";

export function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AssistantError("not_configured");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000 } });
  return client;
}

/* ----------------------------- Erreurs mappées ----------------------------- */

export type AssistantErrorCode =
  | "not_configured"
  | "invalid_key"
  | "model_unavailable"
  | "quota"
  | "timeout"
  | "invalid_response"
  | "rate_limited"
  | "bad_input"
  | "no_speech"
  | "audio_too_large"
  | "unsupported_format"
  | "upstream";

export class AssistantError extends Error {
  code: AssistantErrorCode;
  constructor(code: AssistantErrorCode, cause?: unknown) {
    super(code, { cause });
    this.code = code;
  }
}

/** Traduit une erreur du SDK en code métier sans exposer de détail sensible. */
function mapError(e: unknown): AssistantError {
  if (e instanceof AssistantError) return e;
  const msg = String((e as { message?: string })?.message ?? e);
  const status = Number((e as { status?: number | string })?.status ?? 0) || (/(\d{3})/.exec(msg)?.[1] ? Number(/(\d{3})/.exec(msg)![1]) : 0);
  if (status === 401 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED|invalid api key/i.test(msg)) return new AssistantError("invalid_key");
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) return new AssistantError("quota");
  if (status === 404 || /NOT_FOUND|not found|does not exist|unsupported/i.test(msg)) return new AssistantError("model_unavailable");
  if (/timed? ?out|deadline|abort/i.test(msg)) return new AssistantError("timeout");
  return new AssistantError("upstream");
}

/** Journal serveur assaini : code + statut + extrait court, jamais la clé ni l'audio. */
function logAssistantError(context: string, e: unknown): void {
  const err = e instanceof AssistantError ? e : mapError(e);
  const raw = String((e as { message?: string })?.message ?? "").replace(/AIza[\w-]{10,}/g, "***").slice(0, 300);
  console.error(`[mini-marc] ${context}: ${err.code}${raw ? ` — ${raw}` : ""}`);
}

/* --------------------------- Limitation de débit --------------------------- */
/* File d'attente simple en mémoire (process) — adaptée à la démo ; à remplacer
   par un vrai quota (ex. Redis) en production multi-instance. */

const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMITS: Record<string, { max: number; windowMs: number }> = {
  chat: { max: 20, windowMs: 60_000 },
  transcribe: { max: 8, windowMs: 60_000 },
};

export function rateLimit(kind: "chat" | "transcribe", key: string): void {
  const { max, windowMs } = LIMITS[kind];
  const now = Date.now();
  const b = buckets.get(`${kind}:${key}`);
  if (b && now < b.resetAt) {
    if (b.count >= max) throw new AssistantError("rate_limited");
    b.count += 1;
  } else {
    buckets.set(`${kind}:${key}`, { count: 1, resetAt: now + windowMs });
  }
  // Nettoyage opportuniste pour éviter une croissance mémoire non bornée.
  if (buckets.size > 500) for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}

/* --------------------------------- Chat ---------------------------------- */

export interface ChatReply {
  /** conversation | redaction | navigation | clarification */
  type: "conversation" | "redaction" | "navigation" | "clarification";
  text: string;
  /** Clé du catalogue d'actions — validée côté serveur, jamais une URL libre. */
  actionKey: string | null;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["conversation", "redaction", "navigation", "clarification"] },
    text: { type: "string" },
    actionKey: { type: "string", nullable: true },
  },
  required: ["type", "text"],
};

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 20_000;

function systemPrompt(roleId: RoleId | undefined): string {
  const catalog = catalogForModel(roleId)
    .map((a) => `- ${a.key} : ${a.label} — ${a.hint}`)
    .join("\n");
  return `Tu es Mini Marc, l'assistant intelligent de Cliva, une plateforme de gestion de clinique vétérinaire.
RÈGLES :
- Réponds en français, de façon concise et pratique (quelques phrases sauf demande contraire).
- Tu peux : répondre aux questions sur l'utilisation de Cliva, reformuler, corriger l'orthographe, résumer, structurer des notes, préparer des brouillons (anamnèse, compte rendu, rapport de visite, plan d'actions).
- Contenu vétérinaire : tu structures les informations fournies par l'utilisateur, sans jamais inventer diagnostic, symptômes, posologie ou prescription. Rappelle que toute décision clinique est validée par un professionnel habilité.
- Si la demande est ambiguë, pose UNE question de précision au lieu d'inventer.
- Tu n'as PAS accès aux données de la clinique : n'affirme jamais connaître un patient, un stock ou un chiffre.
- NAVIGATION : si l'utilisateur veut ouvrir une page ou effectuer une action de navigation, renvoie la clé correspondante du catalogue ci-dessous dans "actionKey" (sinon null). Ne mets jamais d'URL dans le texte.
- Les brouillons sont modifiables : présente-les clairement.

CATALOGUE D'ACTIONS AUTORISÉES (clés seules valides) :
${catalog || "(aucune action disponible pour ce profil)"}

Réponds UNIQUEMENT en JSON : {"type": "conversation|redaction|navigation|clarification", "text": "…", "actionKey": "clé_du_catalogue|null"}.`;
}

function parseReply(raw: string | undefined): ChatReply {
  if (!raw) throw new AssistantError("invalid_response");
  let parsed: { type?: string; text?: string; actionKey?: string | null };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Le modèle a rendu du texte brut malgré la consigne — repli contrôlé.
    if (raw.trim()) return { type: "conversation", text: raw.trim().slice(0, 2_000), actionKey: null };
    throw new AssistantError("invalid_response");
  }
  const type = (["conversation", "redaction", "navigation", "clarification"] as const).find((t) => t === parsed.type) ?? "conversation";
  const text = typeof parsed.text === "string" ? parsed.text.trim().slice(0, 4_000) : "";
  if (!text) throw new AssistantError("invalid_response");
  // La clé est conservée seulement si elle figure au catalogue (validation stricte).
  const actionKey = typeof parsed.actionKey === "string" && isKnownActionKey(parsed.actionKey) ? parsed.actionKey : null;
  return { type, text, actionKey };
}

export interface ChatInputMessage {
  role: "user" | "assistant";
  text: string;
}

export async function assistantChat(messages: ChatInputMessage[], roleId: RoleId | undefined): Promise<ChatReply> {
  if (!isConfigured()) throw new AssistantError("not_configured");
  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, MAX_MESSAGE_CHARS) }));
  if (!clean.length || clean.reduce((s, m) => s + m.text.length, 0) > MAX_TOTAL_CHARS) throw new AssistantError("bad_input");

  try {
    const res = await getClient().models.generateContent({
      model: CHAT_MODEL,
      contents: clean.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), parts: [{ text: m.text }] })),
      config: {
        systemInstruction: systemPrompt(roleId),
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 1_500,
      },
    });
    return parseReply(res.text);
  } catch (e) {
    const err = mapError(e);
    if (!["bad_input", "invalid_response"].includes(err.code)) logAssistantError("chat", e);
    throw err;
  }
}

/* ------------------------------ Transcription ----------------------------- */

export const AUDIO_MAX_BYTES = 15 * 1024 * 1024; // 15 Mo
export const AUDIO_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/flac", "audio/aac", "audio/x-aac"];

/** Consigne utilisée uniquement par le modèle de repli (modèle de conversation). */
const TRANSCRIBE_PROMPT = `Transcris fidèlement ce message audio en français. Rends UNIQUEMENT le texte prononcé, sans commentaire, sans mise en forme, sans inventer ce qui n'est pas dit. Si un passage est inaudible ou incertain, note-le entre [crochets].`;

/**
 * Extrait le texte d'une réponse de transcription.
 * `gemini-3.5-transcribe` renvoie la transcription dans des parts
 * `audioTranscription` (une part par énoncé) — `res.text` peut être vide.
 * Les modèles de conversation renvoient un part `text` classique.
 */
function extractTranscript(res: { candidates?: { content?: { parts?: { text?: string; audioTranscription?: { text?: string } }[] } }[] }): string {
  const parts = res.candidates?.flatMap((c) => c.content?.parts ?? []) ?? [];
  return parts
    .map((p) => (typeof p.audioTranscription?.text === "string" && p.audioTranscription.text.trim() ? p.audioTranscription.text.trim() : (p.text ?? "").trim()))
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function transcribeAudio(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  if (!isConfigured()) throw new AssistantError("not_configured");
  if (!bytes.byteLength) throw new AssistantError("bad_input");
  if (bytes.byteLength > AUDIO_MAX_BYTES) throw new AssistantError("audio_too_large");
  if (!AUDIO_MIME_TYPES.includes(mimeType)) throw new AssistantError("unsupported_format");

  const data = Buffer.from(bytes).toString("base64");
  // Modèle STT dédié : generateContent avec le contenu audio seul + config de
  // transcription (format documenté). Détection de langue automatique.
  const tryTranscribeModel = async () =>
    getClient().models.generateContent({
      model: TRANSCRIBE_MODEL,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }] }],
      config: { temperature: 0, maxOutputTokens: 4_000 },
    });
  // Repli : modèle de conversation (compréhension audio des modèles Flash) avec
  // une consigne textuelle, puisque ce modèle répond en texte libre.
  const tryChatModel = async () =>
    getClient().models.generateContent({
      model: CHAT_MODEL,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }, { text: TRANSCRIBE_PROMPT }] }],
      config: { temperature: 0, maxOutputTokens: 4_000 },
    });

  try {
    let res;
    try {
      res = await tryTranscribeModel();
    } catch (e) {
      if (mapError(e).code !== "model_unavailable") throw e;
      res = await tryChatModel();
    }
    const text = extractTranscript(res as Parameters<typeof extractTranscript>[0]);
    if (!text || text === "[aucune voix détectée]") throw new AssistantError("no_speech");
    return text.slice(0, 10_000);
  } catch (e) {
    const err = mapError(e);
    if (!["no_speech", "bad_input"].includes(err.code)) logAssistantError("transcribe", e);
    throw err;
  }
}
