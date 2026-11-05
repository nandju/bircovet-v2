"use client";

import AppModal from "@/components/common/AppModal";
import { FormGrid, SelectField, TextAreaField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { Link } from "@/i18n/navigation";
import { clientName, patientName, userName } from "@/lib/calc";
import { formatDate, formatDateTime } from "@/lib/format";
import { addEvolution, logDay, logDose, stopTreatment } from "@/lib/services/treatmentsService";
import { courseEnd, courseStats, daysWithoutNews, rateTone, slotGrid, TREND_META, type SlotState } from "@/lib/treatments";
import type { DoseLog, EvolutionNote, TreatmentCourse } from "@/lib/types";
import { cn } from "@/utils";
import { useState } from "react";

const CHANNELS = [
  { value: "appel", label: "Appel" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "visite", label: "Passage au cabinet" },
];

function cellClass(s: SlotState, active: boolean) {
  if (s.log?.status === "donne") return s.log.by === "proprietaire" ? "bg-tertiary-500 text-white" : "bg-success-500 text-white";
  if (s.log) return "bg-error-500 text-white";
  if (s.due && active) return "bg-warning-100 text-warning-700 ring-1 ring-warning-400 ring-inset dark:bg-warning-500/20 dark:text-warning-300";
  return "bg-gray-100 text-gray-400 dark:bg-white/5";
}

/** Fiche d'un traitement : grille des prises, observance, évolution, saisie rapide. */
export default function TreatmentCard({ c, now, showPatient = true }: { c: TreatmentCourse; now: string; showPatient?: boolean }) {
  const { db, run, can } = useDemo();
  const [cell, setCell] = useState<SlotState | null>(null);
  const [dose, setDose] = useState<{ status: DoseLog["status"]; channel: string; note: string; whole: boolean }>({ status: "donne", channel: "appel", note: "", whole: false });
  const [evo, setEvo] = useState<{ open: boolean; trend: EvolutionNote["trend"]; text: string }>({ open: false, trend: "amelioration", text: "" });
  const [stop, setStop] = useState<{ open: boolean; reason: string }>({ open: false, reason: "" });
  const s = courseStats(c, now);
  const grid = slotGrid(c, now);
  const days = [...new Set(grid.map((g) => g.day))];
  const today = now.slice(0, 10);
  const active = c.status === "actif";
  const home = c.setting === "domicile";
  const editable = can("hospitalisation", "update") || can("consultations", "update");
  const silent = home ? daysWithoutNews(c, today) : 0;

  const clickCell = (g: SlotState) => {
    if (!active || !editable || g.day > today) return;
    if (!home && !g.log) {
      // En clinique : un clic = prise faite par l'utilisateur connecté.
      run(logDose, { courseId: c.id, day: g.day, slot: g.slot, status: "donne", by: "equipe", channel: "sur_place" }, { silent: true });
      return;
    }
    setDose({ status: g.log?.status ?? "donne", channel: g.log?.channel && g.log.channel !== "sur_place" ? g.log.channel : "appel", note: g.log?.note ?? "", whole: false });
    setCell(g);
  };
  const saveDose = () => {
    if (!cell) return;
    const base = { courseId: c.id, day: cell.day, status: dose.status, by: home ? ("proprietaire" as const) : ("equipe" as const), channel: (home ? dose.channel : "sur_place") as DoseLog["channel"], note: dose.note };
    const r = dose.whole ? run(logDay, base) : run(logDose, { ...base, slot: cell.slot });
    if (r.ok) setCell(null);
  };

  return (
    <article className="cliva-rise rounded-3xl border border-gray-200/70 bg-white shadow-cliva p-4 dark:border-gray-800 dark:bg-white/3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">
            {c.code} · {home ? "À domicile" : "En clinique"} · du {formatDate(c.startDate)} au {formatDate(courseEnd(c))}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-gray-900 dark:text-white">
            {c.label} <span className="font-normal text-gray-600 dark:text-gray-400">— {c.dose} · {c.route} · {c.slots.length}×/jour</span>
          </h3>
          {showPatient && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Link href={`/patients/${c.patientId}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">{patientName(db, c.patientId)}</Link> · {clientName(db, c.clientId)}
              {c.hospitalizationId && <> · <Link href={`/hospitalisation/${c.hospitalizationId}`} className="hover:underline">séjour</Link></>}
            </p>
          )}
          <p className="text-theme-xs text-gray-500">Prescrit par {userName(db, c.vetId)}{c.responsibleId ? ` · suivi : ${userName(db, c.responsibleId)}` : ""}</p>
        </div>
        <div className="text-end">
          <p className={cn("text-2xl font-semibold tabular-nums", rateTone(s.rate))}>{s.rate === null ? "—" : `${s.rate} %`}</p>
          <p className="text-theme-xs text-gray-500">observance · {s.given}/{s.due} prises</p>
          {s.trend && <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", TREND_META[s.trend.trend].chip)}>{TREND_META[s.trend.trend].label}</span>}
        </div>
      </header>

      {(s.overdue > 0 || (home && active && silent >= 2)) && (
        <p className="mt-2 rounded-lg bg-warning-50 px-3 py-1.5 text-theme-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">
          {s.overdue > 0 && `${s.overdue} prise(s) échue(s) sans confirmation. `}
          {home && silent >= 2 && `Aucune nouvelle du propriétaire depuis ${silent} jour(s) : appelez pour vérifier.`}
        </p>
      )}

      <div className="custom-scrollbar mt-3 overflow-x-auto">
        <table className="border-separate border-spacing-1 text-[10px]">
          <thead>
            <tr>
              <th />
              {days.map((d) => (
                <th key={d} className={cn("px-0.5 font-medium", d === today ? "text-brand-600" : "text-gray-500")}>{d.slice(8, 10)}/{d.slice(5, 7)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.slots.map((slot) => (
              <tr key={slot}>
                <th className="pe-1 text-end font-medium text-gray-500">{slot}</th>
                {days.map((d) => {
                  const g = grid.find((x) => x.day === d && x.slot === slot)!;
                  return (
                    <td key={d}>
                      <button
                        type="button"
                        onClick={() => clickCell(g)}
                        disabled={!active || !editable || d > today}
                        title={g.log ? `${g.log.status === "donne" ? "Donné" : g.log.status === "refuse" ? "Refusé" : "Manqué"} — ${g.log.by === "proprietaire" ? "confirmé par le propriétaire" : userName(db, g.log.userId)} le ${formatDateTime(g.log.at)}${g.log.note ? ` · ${g.log.note}` : ""}` : g.due ? "À confirmer" : "Prévu"}
                        className={cn("cliva-press flex size-7 items-center justify-center rounded-md font-semibold transition-colors", cellClass(g, active))}
                      >
                        {g.log?.status === "donne" ? "✓" : g.log ? "✕" : g.due && active ? "!" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-success-500" />Fait par l&apos;équipe</li>
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-tertiary-500" />Confirmé par le propriétaire</li>
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-error-500" />Manqué / refusé</li>
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-warning-100 ring-1 ring-warning-400" />Échu à confirmer</li>
      </ul>

      {c.evolution.length > 0 && (
        <ol className="mt-3 space-y-1.5 border-s-2 border-gray-100 ps-3 dark:border-gray-800">
          {[...c.evolution].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((e) => (
            <li key={e.id} className="text-theme-xs text-gray-700 dark:text-gray-300">
              <span className={cn("me-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium", TREND_META[e.trend].chip)}>{TREND_META[e.trend].label}</span>
              {e.text} <span className="text-gray-400">— {e.source === "proprietaire" ? "propriétaire" : userName(db, e.userId)}, {formatDateTime(e.date)}</span>
            </li>
          ))}
        </ol>
      )}

      {active && editable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {home && (
            <Button size="xs" onClick={() => { setDose({ status: "donne", channel: "appel", note: "", whole: true }); setCell({ day: today, slot: c.slots[0], due: true }); }}>
              Le propriétaire confirme aujourd&apos;hui
            </Button>
          )}
          <Button size="xs" variant="soft" onClick={() => setEvo({ open: true, trend: "amelioration", text: "" })}>Noter l&apos;évolution</Button>
          <Button size="xs" variant="ghost" onClick={() => setStop({ open: true, reason: "" })}>Terminer / arrêter</Button>
        </div>
      )}
      {!active && <p className="mt-2 text-theme-xs text-gray-500">{c.status === "termine" ? "Traitement terminé" : "Traitement arrêté"}{c.stopReason ? ` — ${c.stopReason}` : ""}.</p>}

      <AppModal
        isOpen={!!cell}
        onClose={() => setCell(null)}
        title={home ? "Prise à domicile" : "Prise en clinique"}
        description={cell ? `${c.label} — ${formatDate(cell.day)}${dose.whole ? " (toute la journée)" : ` à ${cell.slot}`}` : ""}
        footer={<><Button size="sm" variant="outline" onClick={() => setCell(null)}>Annuler</Button><Button size="sm" onClick={saveDose}>Enregistrer</Button></>}
      >
        <FormGrid>
          <SelectField label="Résultat" value={dose.status} onChange={(x) => setDose({ ...dose, status: x as DoseLog["status"] })} options={[{ value: "donne", label: home ? "Donné par le propriétaire" : "Administré" }, { value: "manque", label: "Oublié / pas fait" }, { value: "refuse", label: "Refusé par l'animal / vomi" }]} />
          {home && <SelectField label="Comment l'avez-vous su ?" value={dose.channel} onChange={(x) => setDose({ ...dose, channel: x })} options={CHANNELS} />}
          <TextAreaField label="Remarque" value={dose.note} onChange={(x) => setDose({ ...dose, note: x })} rows={2} className="sm:col-span-2" />
        </FormGrid>
        {home && <p className="mt-2 text-theme-xs text-gray-500">Le contact est aussi noté dans l&apos;historique du client.</p>}
      </AppModal>

      <AppModal
        isOpen={evo.open}
        onClose={() => setEvo({ ...evo, open: false })}
        title="Évolution sous traitement"
        footer={<><Button size="sm" variant="outline" onClick={() => setEvo({ ...evo, open: false })}>Annuler</Button><Button size="sm" onClick={() => run(addEvolution, { courseId: c.id, trend: evo.trend, text: evo.text, source: home ? "proprietaire" : "clinique" }).ok && setEvo({ ...evo, open: false })}>Enregistrer</Button></>}
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(Object.keys(TREND_META) as EvolutionNote["trend"][]).map((k) => (
            <button key={k} type="button" aria-pressed={evo.trend === k} onClick={() => setEvo({ ...evo, trend: k })} className={cn("rounded-full border px-3 py-1 text-sm", evo.trend === k ? "border-transparent " + TREND_META[k].chip : "border-gray-200 text-gray-600 dark:border-gray-700")}>
              {TREND_META[k].label}
            </button>
          ))}
        </div>
        <TextAreaField label={home ? "Ce que rapporte le propriétaire" : "Observation clinique"} value={evo.text} onChange={(x) => setEvo({ ...evo, text: x })} rows={3} />
      </AppModal>

      <AppModal
        isOpen={stop.open}
        onClose={() => setStop({ ...stop, open: false })}
        title="Fin du traitement"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => run(stopTreatment, { courseId: c.id, status: "arrete", reason: stop.reason }).ok && setStop({ ...stop, open: false })}>Arrêter (motif requis)</Button>
            <Button size="sm" onClick={() => run(stopTreatment, { courseId: c.id, status: "termine", reason: stop.reason }).ok && setStop({ ...stop, open: false })}>Traitement terminé</Button>
          </>
        }
      >
        <TextAreaField label="Commentaire / motif" value={stop.reason} onChange={(x) => setStop({ ...stop, reason: x })} rows={2} />
      </AppModal>
    </article>
  );
}
