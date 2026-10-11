"use client";

import { useSearchParams } from "next/navigation";

/** Lit un paramètre d'URL (une frontière Suspense est posée dans le layout admin). */
export function useQueryParam(name: string): string | null {
  return useSearchParams().get(name);
}
