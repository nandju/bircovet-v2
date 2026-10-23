import { NextRequest, NextResponse } from "next/server";
import { AssistantError, rateLimit, transcribeAudio, type AssistantErrorCode } from "@/lib/assistant/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES: Record<AssistantErrorCode, string> = {
  not_configured: "La transcription serveur n'est pas configurée : clé Gemini absente (GEMINI_API_KEY). La dictée du navigateur reste disponible.",
  invalid_key: "La clé API configurée est invalide ou refusée. Vérifiez GEMINI_API_KEY côté serveur.",
  model_unavailable: "Le modèle de transcription n'est pas disponible pour ce compte. Ajustez GEMINI_TRANSCRIBE_MODEL.",
  quota: "Le quota de l'API Gemini est atteint. Réessayez plus tard ou utilisez la dictée du navigateur.",
  rate_limited: "Trop de transcriptions en peu de temps — patientez une minute.",
  timeout: "La transcription a dépassé le délai imparti. Essayez un enregistrement plus court.",
  invalid_response: "La transcription renvoyée est illisible. Réessayez.",
  bad_input: "Aucun audio exploitable reçu.",
  no_speech: "Aucune voix détectée dans cet enregistrement. Parlez plus près du micro et réessayez.",
  audio_too_large: "Le fichier audio dépasse 15 Mo. Enregistrez plus court ou compressez le fichier.",
  unsupported_format: "Format audio non pris en charge (acceptés : WebM, OGG, MP3, M4A/MP4, WAV, FLAC, AAC).",
  upstream: "Le service de transcription est momentanément indisponible. Réessayez.",
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

/**
 * POST /api/assistant/transcribe — transcription audio via Gemini (multipart).
 * Le fichier est traité en mémoire et n'est pas conservé.
 */
export async function POST(req: NextRequest) {
  try {
    rateLimit("transcribe", req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local");
    const form = await req.formData().catch(() => null);
    const file = form?.get("audio");
    if (!(file instanceof File)) throw new AssistantError("bad_input");
    // Types MIME avec paramètres (ex. "audio/webm;codecs=opus") — on conserve le type de base.
    const mime = (file.type || "audio/webm").split(";")[0].trim().toLowerCase();
    const text = await transcribeAudio(await file.arrayBuffer(), mime);
    return NextResponse.json({ text });
  } catch (e) {
    const code = e instanceof AssistantError ? e.code : "upstream";
    return NextResponse.json({ error: { code, message: MESSAGES[code] } }, { status: STATUS[code] });
  }
}
