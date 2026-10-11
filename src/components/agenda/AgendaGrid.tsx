"use client";

import { useDemo } from "@/context/DemoStoreContext";
import { patientName, userName } from "@/lib/calc";
import { formatTime, isoDay } from "@/lib/format";
import type { Appointment, Unavailability } from "@/lib/types";
import { cn } from "@/utils";

const START_H = 7;
const END_H = 20;
const HOUR_PX = 56;
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const STATUS_CLS: Record<string, string> = {
  planifie: "border-tertiary-300 bg-tertiary-50 text-tertiary-800 dark:border-tertiary-700 dark:bg-tertiary-500/15 dark:text-tertiary-200",
  confirme: "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
  honore: "border-secondary-300 bg-secondary-50 text-secondary-800 dark:border-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-200",
  annule: "border-gray-200 bg-gray-50 text-gray-400 line-through dark:border-gray-700 dark:bg-white/3",
  absent: "border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700 dark:bg-warning-500/15",
};

const minutes = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

interface Props {
  days: Date[];
  appointments: Appointment[];
  unavailabilities: Unavailability[];
  conflictIds: Set<string>;
  onSlot: (startIso: string) => void;
  onOpen: (a: Appointment) => void;
}

/** Grille horaire jour / semaine (positionnement des créneaux, indisponibilités, conflits). */
export default function AgendaGrid({ days, appointments, unavailabilities, conflictIds, onSlot, onOpen }: Props) {
  const { db, today } = useDemo();
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  return (
    <div className="custom-scrollbar overflow-x-auto">
      <div className="min-w-full" style={{ minWidth: days.length > 1 ? 840 : undefined }}>
        <div className="sticky top-0 z-1 grid border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={cn("px-2 py-2 text-center text-theme-xs font-medium", isoDay(d) === today ? "text-brand-600 dark:text-brand-400" : "text-gray-500")}>
              {DAYS[d.getDay()]} <span className="text-sm">{d.getDate()}</span>
            </div>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="pe-2 text-end text-[11px] text-gray-400" style={{ height: HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d) => {
            const key = isoDay(d);
            const dayAppts = appointments.filter((a) => a.start.slice(0, 10) === key);
            const dayUna = unavailabilities.filter((u) => u.start.slice(0, 10) <= key && u.end.slice(0, 10) >= key);
            return (
              <div key={key} className="relative border-s border-gray-100 dark:border-gray-800">
                {hours.map((h) => (
                  <div key={h} className="border-b border-gray-100 dark:border-gray-800" style={{ height: HOUR_PX }}>
                    {[0, 30].map((m) => (
                      <button
                        key={m}
                        aria-label={`Créer un rendez-vous le ${key} à ${h}:${m || "00"}`}
                        onClick={() => onSlot(`${key}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)}
                        className="block h-1/2 w-full hover:bg-brand-25 dark:hover:bg-white/3"
                      />
                    ))}
                  </div>
                ))}
                {dayUna.map((u) => {
                  const s = u.start.slice(0, 10) < key ? START_H * 60 : minutes(u.start);
                  const e = u.end.slice(0, 10) > key ? END_H * 60 : minutes(u.end);
                  return (
                    <div
                      key={u.id}
                      className="pointer-events-none absolute inset-x-0.5 rounded-md border border-dashed border-gray-300 bg-gray-100/80 dark:bg-white/5 px-1.5 py-1 text-[10px] text-gray-500 dark:border-gray-700"
                      style={{ top: ((s - START_H * 60) / 60) * HOUR_PX, height: Math.max(18, ((e - s) / 60) * HOUR_PX) }}
                    >
                      Indisponible — {userName(db, u.userId)} ({u.reason})
                    </div>
                  );
                })}
                {dayAppts.map((a, i) => {
                  const s = minutes(a.start);
                  const overlapping = dayAppts.filter((b) => b.status !== "annule" && minutes(b.start) < s + a.durationMin && s < minutes(b.start) + b.durationMin);
                  const idx = overlapping.findIndex((b) => b.id === a.id);
                  const width = 100 / Math.max(1, overlapping.length);
                  return (
                    <button
                      key={a.id}
                      onClick={() => onOpen(a)}
                      className={cn("absolute overflow-hidden rounded-md border px-1.5 py-1 text-start text-[11px] leading-tight shadow-theme-xs transition hover:z-9 hover:shadow-theme-md", STATUS_CLS[a.status], conflictIds.has(a.id) && "ring-2 ring-error-500")}
                      style={{ top: ((s - START_H * 60) / 60) * HOUR_PX + 1, height: Math.max(20, (a.durationMin / 60) * HOUR_PX - 2), insetInlineStart: `${(idx < 0 ? i : idx) * width}%`, width: `calc(${width}% - 2px)` }}
                      title={`${formatTime(a.start)} ${a.reason} — ${patientName(db, a.patientId)}`}
                    >
                      <span className="block truncate font-semibold">
                        {formatTime(a.start)} {patientName(db, a.patientId)}
                      </span>
                      <span className="block truncate">{a.reason}</span>
                      <span className="block truncate opacity-70">{userName(db, a.practitionerId)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
