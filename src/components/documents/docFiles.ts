"use client";

import type { DocumentItem } from "@/lib/types";
import { downloadBlob, downloadText } from "@/utils/export";

/**
 * Fichiers choisis dans le navigateur : conservés en mémoire (URL temporaires),
 * jamais exposés par un lien public ni persistés. Ils disparaissent au rechargement.
 */
const localFiles = new Map<string, File>();

export const setLocalFile = (docId: string, file: File) => localFiles.set(docId, file);
export const getLocalFile = (docId: string) => localFiles.get(docId);

export function downloadDocument(doc: DocumentItem): boolean {
  const f = localFiles.get(doc.id);
  if (f) {
    downloadBlob(f, doc.fileName);
    return true;
  }
  if (doc.contentText) {
    downloadText(doc.fileName.endsWith(".txt") ? doc.fileName : `${doc.fileName}.txt`, `${doc.contentText}\n\n— Document de démonstration Cliva (fictif) —`);
    return true;
  }
  return false;
}

export const formatSize = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`);
