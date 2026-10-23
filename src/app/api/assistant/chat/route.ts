import { NextRequest, NextResponse } from "next/server";
import { resolveAction } from "@/lib/assistant/actions";
import { AssistantError, assistantChat, rateLimit, type AssistantErrorCode } from "@/lib/assistant/server";
import { ROLE_LABELS } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES: Record<AssistantErrorCode, string> = {
  not_configured: "L'assistant IA n'est pas encore configuré : la clé Gemini côté serveur est absente (variable GEMINI_API_KEY). La navigation locale reste disponible.",
  invalid_key: "La clé API configurée est invalide ou refusée. Vérifiez la variable GEMINI_API_KEY côté serveur.",
  model_unavailable: "Le modèle configuré n'est pas disponible pour ce compte. Ajustez GEMINI_MODEL (ex. gemini-3.5-flash-lite).",
  quota: "Le quota de l'API Gemini est atteint. Réessayez plus tard ou vérifiez votre offre.",
  rate_limited: "Trop de requêtes en peu de temps — patientez une minute avant de réessayer.",
  timeout: "Le service a mis trop de temps à répondre. Réessayez.",
  invalid_response: "La réponse du modèle est illisible. Réessayez ou reformulez votre demande.",
  bad_input: "Le message est vide ou trop long. Raccourcissez-le (4000 caractères max par message).",
  no_speech: "Aucune voix détectée dans l'audio.",
  audio_too_large: "Le fichier audio dépasse la taille autorisée.",
  unsupported_format: "Format audio non pris en charge.",
  upstream: "Le service IA est momentanément indisponible. Réessayez dans un instant.",
};

const STATUS: Record<AssistantErrorCode, number> = {
  not_configured: 503,
  invalid_key: 502,
  model_unavailable: 502,
  quota: 429,
  rate_limited: 429,
  timeout: 504,
  invalid_response: 502,
  bad_input: 400,
  no_speech: 422,
  audio_too_large: 413,
  unsupported_format: 415,
  upstream: 502,
};

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

function err(e: unknown) {
  const code = e instanceof AssistantError ? e.code : "upstream";
  return NextResponse.json({ error: { code, message: MESSAGES[code] } }, { status: STATUS[code] });
}

/**
 * POST /api/assistant/chat — conversation et rédaction Mini Marc.
 * NB : l'authentification de cette application de démonstration est simulée
 * côté client ; le `roleId` reçu sert uniquement à filtrer les actions du
 * catalogue (validation côté serveur de la clé et de la permission simulée).
 * Avec un vrai backend, le rôle devra provenir de la session serveur.
 */
export async function POST(req: NextRequest) {
  try {
    rateLimit("chat", clientKey(req));
    const body = (await req.json().catch(() => null)) as { messages?: { role?: string; text?: string }[]; roleId?: string } | null;
    const roleId = body?.roleId && body.roleId in ROLE_LABELS ? (body.roleId as RoleId) : undefined;
    if (!Array.isArray(body?.messages)) throw new AssistantError("bad_input");
    const reply = await assistantChat(
      body.messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: String(m.text ?? "") })),
      roleId
    );
    // La clé est revalidée ici : catalogue + permission du rôle. Jamais d'URL libre.
    const action = resolveAction(reply.actionKey ?? undefined, roleId);
    return NextResponse.json({
      reply: { type: action ? "navigation" : reply.type, text: reply.text },
      action: action ? { key: action.key, label: action.label, path: action.path } : null,
    });
  } catch (e) {
    return err(e);
  }
}
