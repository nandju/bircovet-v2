"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SearchInput from "@/components/common/SearchInput";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { formatDate, normalize } from "@/lib/format";
import { PROTOCOL_CATS } from "@/lib/protocols";
import type { ProtocolInput } from "@/lib/services/protocolsService";
import type { ProtocolCategory } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import ProtocolEditor from "./ProtocolEditor";

export const EMPTY_PROTOCOL: ProtocolInput = { title: "", category: "prise_en_charge", subject: "", species: [], summary: "", steps: [], materials: [], warnings: "", links: [] };

export default function ProtocolsPage() {
  const { db } = useDemo();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ProtocolCategory | "">("");
  const [edit, setEdit] = useState<ProtocolInput | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const t = normalize(q);
  const all = (db.protocols ?? []).filter((p) => showArchived || p.status !== "archive");
  const list = all.filter((p) => (!cat || p.category === cat) && (!t || normalize(`${p.title} ${p.subject} ${p.summary} ${p.species.join(" ")} ${p.steps.map((s) => s.text).join(" ")}`).includes(t)));
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Protocoles et fiches" subtitle="Conduites à tenir, parcours client, accueil, préparation des visites et des chirurgies" actions={<Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit({ ...EMPTY_PROTOCOL, category: cat || "prise_en_charge" })}>Nouvelle fiche</Button>} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-96"><SearchInput value={q} onChange={setQ} placeholder="Pathologie, mot-clé, espèce…" /></div>
        <label className="flex items-center gap-2 text-theme-xs text-gray-600 dark:text-gray-400"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-brand-500" />Afficher les archives</label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!cat} onClick={() => setCat("")} className={cn("cliva-press rounded-full border px-3 py-1 text-sm", !cat ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")}>Toutes <span className="opacity-60">{all.length}</span></button>
        {(Object.keys(PROTOCOL_CATS) as ProtocolCategory[]).map((k) => {
          const n = all.filter((p) => p.category === k).length;
          if (!n && k === "autre") return null;
          return (
            <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={cn("cliva-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", cat === k ? "border-transparent " + PROTOCOL_CATS[k].chip : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")}>
              <span className={cn("size-2 rounded-full", PROTOCOL_CATS[k].dot)} />{PROTOCOL_CATS[k].label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <li key={p.id} className="cliva-rise">
            <Link href={`/protocoles/${p.id}`} className="flex h-full flex-col rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 transition hover:-translate-y-0.5 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/3">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PROTOCOL_CATS[p.category].chip)}>{PROTOCOL_CATS[p.category].label}</span>
                <span className={cn("text-[11px]", p.status === "valide" ? "text-success-600" : p.status === "brouillon" ? "text-warning-600" : "text-gray-400")}>{p.status === "valide" ? "Validée" : p.status === "brouillon" ? "Brouillon" : "Archivée"} · v{p.version}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-white">{p.title}</h3>
              {p.subject && <p className="text-theme-xs text-gray-500">{p.subject}</p>}
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-600 dark:text-gray-400">{p.summary}</p>
              <p className="mt-2 text-[11px] text-gray-500">{p.steps.length} étape(s){p.steps.some((s) => s.critical) ? ` dont ${p.steps.filter((s) => s.critical).length} critique(s)` : ""}{p.species.length ? ` · ${p.species.join(", ")}` : ""} · {formatDate(p.updatedAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">Aucune fiche ne correspond.</p>}
      <ProtocolEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
