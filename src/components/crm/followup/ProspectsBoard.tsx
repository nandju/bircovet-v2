"use client";

import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { PlusIcon } from "@/icons";
import { formatDate, formatXOF } from "@/lib/format";
import { moveProspect, PROSPECT_STAGES } from "@/lib/services/followUpService";
import type { Prospect, ProspectStage } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";
import { channelLabel, fmtDue, ProspectContactModal, ProspectLostModal, ProspectModal, sourceLabel, useConvertProspect } from "./FollowUpModals";

const OPEN: ProspectStage[] = ["nouveau", "contacte", "besoin_identifie", "proposition"];
const ACT: Record<Prospect["activity"], string> = { compagnie: "Compagnie", rente: "Rente", mixte: "Mixte" };

export default function ProspectsBoard() {
  const { db, today, run, can } = useDemo();
  const [edit, setEdit] = useState<Prospect | null | "new">(null);
  const [contact, setContact] = useState<Prospect | null>(null);
  const [lost, setLost] = useState<Prospect | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const convert = useConvertProspect();
  const editable = can("relation", "update");
  const prospects = db.prospects ?? [];
  const open = prospects.filter((p) => OPEN.includes(p.stage));
  const won = prospects.filter((p) => p.stage === "gagne");
  const lostList = prospects.filter((p) => p.stage === "perdu");
  const dueNow = open.filter((p) => p.nextActionDate && p.nextActionDate <= today).length;
  const pipeline = open.reduce((s, p) => s + (p.estimatedValue || 0), 0);
  const rate = won.length + lostList.length ? Math.round((won.length / (won.length + lostList.length)) * 100) : 0;

  const next = (s: ProspectStage) => OPEN[OPEN.indexOf(s) + 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-gray-500 dark:text-gray-400">En cours</dt>
            <dd className="font-semibold text-gray-800 tabular-nums dark:text-white/90">{open.length}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-gray-500 dark:text-gray-400">À relancer aujourd&apos;hui</dt>
            <dd className={cn("font-semibold tabular-nums", dueNow ? "text-error-600 dark:text-error-400" : "text-gray-800 dark:text-white/90")}>{dueNow}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-gray-500 dark:text-gray-400">Potentiel</dt>
            <dd className="font-semibold text-gray-800 tabular-nums dark:text-white/90">{formatXOF(pipeline)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-gray-500 dark:text-gray-400">Taux de conversion</dt>
            <dd className="font-semibold text-gray-800 tabular-nums dark:text-white/90">{rate} %</dd>
          </div>
        </dl>
        {editable && (
          <Button size="sm" startIcon={<PlusIcon />} onClick={() => setEdit("new")}>
            Nouveau prospect
          </Button>
        )}
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[880px] grid-cols-4 gap-3">
          {OPEN.map((stage) => {
            const meta = PROSPECT_STAGES.find((s) => s.key === stage)!;
            const items = open.filter((p) => p.stage === stage).sort((a, b) => (a.nextActionDate ?? "9").localeCompare(b.nextActionDate ?? "9"));
            return (
              <section key={stage} aria-label={meta.label} className="flex min-w-0 flex-col rounded-2xl bg-gray-50 p-2 dark:bg-white/3">
                <header className="px-2 pt-1 pb-2">
                  <h3 className="flex items-baseline justify-between text-sm font-semibold text-gray-800 dark:text-white/90">
                    {meta.label}
                    <span className="text-theme-xs font-normal text-gray-400 tabular-nums">{items.length}</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{meta.hint}</p>
                </header>
                <ul className="flex flex-col gap-2">
                  {items.map((p) => {
                    const late = p.nextActionDate && p.nextActionDate < today;
                    const due = p.nextActionDate && p.nextActionDate <= today;
                    const showHist = detail === p.id;
                    return (
                      <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => editable && setEdit(p)} className="min-w-0 text-start">
                            <span className="block truncate text-sm font-semibold text-gray-800 hover:underline dark:text-white/90">{p.name}</span>
                            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                              {ACT[p.activity]} · {sourceLabel(p.source)}
                            </span>
                          </button>
                          {p.estimatedValue > 0 && <span className="shrink-0 text-[11px] font-medium text-gray-500 tabular-nums">{formatXOF(p.estimatedValue)}</span>}
                        </div>
                        {p.animals && <p className="mt-1.5 text-theme-xs text-gray-600 dark:text-gray-400">{p.animals}</p>}
                        {p.need && <p className="mt-1 text-theme-xs text-gray-800 dark:text-gray-200"><span className="text-gray-500">Besoin : </span>{p.need}</p>}
                        {p.difficulties && <p className="mt-0.5 text-theme-xs text-gray-800 dark:text-gray-200"><span className="text-gray-500">Difficultés : </span>{p.difficulties}</p>}
                        {p.nextAction && (
                          <p className={cn("mt-2 rounded-lg px-2 py-1 text-[11px]", late ? "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300" : due ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300" : "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-400")}>
                            {p.nextActionDate ? `${fmtDue(p.nextActionDate, today)} · ` : ""}
                            {p.nextAction}
                          </p>
                        )}
                        {showHist && (
                          <ol className="mt-2 space-y-1 border-s border-gray-200 ps-2 dark:border-gray-700">
                            {p.history.slice(0, 6).map((h, i) => (
                              <li key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                                <span className="text-gray-700 dark:text-gray-300">{formatDate(h.date.slice(0, 10))}</span> · {h.action}
                                {h.channel ? ` (${channelLabel(h.channel)})` : ""}
                                {h.note ? ` — ${h.note}` : ""}
                              </li>
                            ))}
                          </ol>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {editable && (
                            <Button size="xs" onClick={() => setContact(p)}>
                              Contacter
                            </Button>
                          )}
                          {editable && stage !== "proposition" && (
                            <Button size="xs" variant="soft" onClick={() => run(moveProspect, { id: p.id, stage: next(stage) })}>
                              {PROSPECT_STAGES.find((s) => s.key === next(stage))?.label} →
                            </Button>
                          )}
                          {editable && stage === "proposition" && (
                            <Button size="xs" variant="soft" onClick={() => convert(p)}>
                              Convertir en client
                            </Button>
                          )}
                          <Button size="xs" variant="ghost" onClick={() => setDetail(showHist ? null : p.id)} aria-expanded={showHist}>
                            Historique
                          </Button>
                          {editable && (
                            <Button size="xs" variant="ghost" onClick={() => setLost(p)}>
                              Perdu
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {items.length === 0 && <li className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-theme-xs text-gray-400 dark:border-gray-700">Aucun prospect</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {(won.length > 0 || lostList.length > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Devenus clients · {won.length}</h3>
            <ul className="mt-2 space-y-1 text-theme-xs">
              {won.slice(0, 6).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  {p.convertedClientId ? <Link href={`/clients/${p.convertedClientId}`} className="truncate text-brand-600 hover:underline dark:text-brand-400">{p.name}</Link> : <span>{p.name}</span>}
                  <span className="text-gray-400">{formatDate(p.updatedAt)}</span>
                </li>
              ))}
              {won.length === 0 && <li className="text-gray-400">Aucun pour l&apos;instant</li>}
            </ul>
          </section>
          <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Perdus · {lostList.length}</h3>
            <ul className="mt-2 space-y-1 text-theme-xs">
              {lostList.slice(0, 6).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate text-gray-700 dark:text-gray-300">{p.name}</span>
                  <span className="truncate text-gray-400">{p.lostReason}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ProspectModal isOpen={edit !== null} onClose={() => setEdit(null)} prospect={edit && edit !== "new" ? edit : undefined} />
      <ProspectContactModal prospect={contact} onClose={() => setContact(null)} />
      <ProspectLostModal prospect={lost} onClose={() => setLost(null)} />
    </div>
  );
}
