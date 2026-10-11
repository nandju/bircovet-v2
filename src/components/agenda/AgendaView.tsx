"use client";

import AppModal from "@/components/common/AppModal";
import Can from "@/components/common/Can";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Panel from "@/components/common/Panel";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import { FormGrid, SelectField, TextField } from "@/components/form/Field";
import Select from "@/components/form/Select";
import DataTable from "@/components/tables/DataTable";
import Button from "@/components/ui/button/Button";
import Tabs from "@/components/ui/tabs/Tabs";
import { useDemo } from "@/context/DemoStoreContext";
import { useModal } from "@/hooks/useModal";
import { useOptions } from "@/hooks/useOptions";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { ChevronLeftIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { clientName, patientName, userName } from "@/lib/calc";
import { addDays, formatDate, formatDateLong, formatDateTime, isoDay, isoLocal, normalize } from "@/lib/format";
import { optionsOf } from "@/lib/labels";
import { addUnavailability, findConflicts, removeUnavailability } from "@/lib/services/appointmentsService";
import type { Appointment } from "@/lib/types";
import { cn } from "@/utils";
import { useEffect, useMemo, useState } from "react";
import AgendaGrid from "./AgendaGrid";
import AppointmentModal from "./AppointmentModal";

type View = "jour" | "semaine" | "mois" | "liste";

function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default function AgendaView() {
  const { db, run, establishment, user, today } = useDemo();
  const opts = useOptions();
  const nouveau = useQueryParam("nouveau");
  const [view, setView] = useState<View>("semaine");
  const [cursor, setCursor] = useState(() => new Date());
  const [filters, setFilters] = useState({ practitioner: "", est: establishment?.id ?? "", status: "", q: "" });
  const [selected, setSelected] = useState<Appointment | undefined>();
  const [defaultStart, setDefaultStart] = useState<string | undefined>();
  const apptModal = useModal();
  const unaModal = useModal();
  const [una, setUna] = useState({ userId: "", start: "", end: "", reason: "" });

  const openAppt = apptModal.openModal;
  useEffect(() => {
    if (nouveau) {
      setSelected(undefined);
      setDefaultStart(undefined);
      openAppt();
    }
  }, [nouveau, openAppt]);
  useEffect(() => {
    const onResize = () => window.innerWidth < 768 && setView((v) => (v === "semaine" ? "jour" : v));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const filtered = useMemo(() => {
    const t = normalize(filters.q);
    return db.appointments.filter(
      (a) =>
        (!filters.practitioner || a.practitionerId === filters.practitioner) &&
        (!filters.est || a.establishmentId === filters.est) &&
        (!filters.status || a.status === filters.status) &&
        (!t || normalize(`${patientName(db, a.patientId)} ${clientName(db, a.clientId)} ${a.reason}`).includes(t)),
    );
  }, [db, filters]);

  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of filtered) if (a.status !== "annule" && findConflicts(db, a, a.id).some((c) => c.kind !== "indisponibilite")) s.add(a.id);
    return s;
  }, [db, filtered]);

  const days = useMemo(() => {
    if (view === "jour") return [new Date(cursor)];
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + i));
  }, [view, cursor]);

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === "jour") d.setDate(d.getDate() + dir);
    else if (view === "semaine") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  const openSlot = (iso: string) => {
    if (user && !["dg", "vet", "assistant", "accueil"].includes(user.roleId)) return;
    setSelected(undefined);
    setDefaultStart(iso);
    apptModal.openModal();
  };
  const openExisting = (a: Appointment) => {
    setSelected(a);
    apptModal.openModal();
  };

  const title = view === "jour" ? formatDateLong(cursor) : view === "semaine" ? `Semaine du ${formatDate(days[0])} au ${formatDate(days[6])}` : cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const visibleUna = db.unavailabilities.filter((u) => !filters.practitioner || u.userId === filters.practitioner);

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Agenda"
        subtitle={`${establishment?.name} · créneau par défaut ${establishment?.slotMinutes} min`}
        actions={
          <Can module="agenda" action="create">
            <Button size="sm" variant="outline" onClick={() => { setUna({ userId: "", start: isoLocal(), end: isoLocal(new Date(Date.now() + 3600000)), reason: "" }); unaModal.openModal(); }}>
              Indisponibilité
            </Button>
            <Button size="sm" startIcon={<PlusIcon />} onClick={() => openSlot("")}>
              Nouveau rendez-vous
            </Button>
          </Can>
        }
      />
      <Panel>
        <div className="flex flex-col gap-3 px-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => shift(-1)} title="Précédent">
              <ChevronLeftIcon className="size-4 rtl:rotate-180" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
              Aujourd&apos;hui
            </Button>
            <Button size="sm" variant="outline" onClick={() => shift(1)} title="Suivant">
              <ChevronLeftIcon className="size-4 rotate-180 rtl:rotate-0" />
            </Button>
            <span className="ms-2 text-sm font-medium text-gray-800 capitalize dark:text-white/90">{title}</span>
          </div>
          <Tabs tabs={[{ key: "jour", label: "Jour" }, { key: "semaine", label: "Semaine" }, { key: "mois", label: "Mois" }, { key: "liste", label: "Liste" }]} active={view} onChange={(k) => setView(k as View)} />
        </div>
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={filters.q} onChange={(q) => setFilters({ ...filters, q })} placeholder="Patient, client, motif…" />
          <Select value={filters.practitioner} onChange={(practitioner) => setFilters({ ...filters, practitioner })} options={opts.staff} placeholder="Tous les intervenants" allowEmpty />
          <Select value={filters.est} onChange={(est) => setFilters({ ...filters, est })} options={opts.establishments} placeholder="Tous les établissements" allowEmpty />
          <Select value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={optionsOf("appointment")} placeholder="Tous les statuts" allowEmpty />
        </div>
        {conflictIds.size > 0 && <p className="mx-4 mb-3 rounded-lg bg-error-25 px-3 py-2 text-theme-xs text-error-700 dark:bg-error-500/10 dark:text-error-300">{conflictIds.size} rendez-vous en conflit de créneau (cerclés de rouge).</p>}

        {(view === "jour" || view === "semaine") && <AgendaGrid days={days} appointments={filtered} unavailabilities={visibleUna} conflictIds={conflictIds} onSlot={openSlot} onOpen={openExisting} />}

        {view === "mois" && <MonthGrid cursor={cursor} appointments={filtered} onDay={(d) => { setCursor(d); setView("jour"); }} />}

        {view === "liste" && (
          <DataTable
            rows={filtered.filter((a) => a.start.slice(0, 10) >= addDays(today, -30))}
            rowKey={(a) => a.id}
            onRowClick={openExisting}
            initialSort={{ key: "d", dir: "asc" }}
            rowClassName={(a) => (conflictIds.has(a.id) ? "bg-error-25 dark:bg-error-500/5" : "")}
            columns={[
              { key: "d", header: "Date", primary: true, sortValue: (a) => a.start, render: (a) => formatDateTime(a.start) },
              { key: "p", header: "Patient", render: (a) => patientName(db, a.patientId) },
              { key: "c", header: "Client", render: (a) => clientName(db, a.clientId) },
              { key: "r", header: "Motif", render: (a) => a.reason },
              { key: "w", header: "Intervenant", render: (a) => userName(db, a.practitionerId) },
              { key: "s", header: "Statut", render: (a) => <StatusBadge kind="appointment" value={a.status} /> },
            ]}
          />
        )}
      </Panel>

      {visibleUna.length > 0 && (
        <Panel className="mt-4" title="Indisponibilités des intervenants">
          <ul className="divide-y divide-gray-100 px-4 dark:divide-gray-800">
            {visibleUna.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{userName(db, u.userId)}</strong> — {formatDateTime(u.start)} → {formatDateTime(u.end)} · {u.reason}
                </span>
                <Can module="agenda" action="update">
                  <Button size="xs" variant="ghost" onClick={() => run(removeUnavailability, { id: u.id })} title="Supprimer">
                    <TrashBinIcon className="size-4" />
                  </Button>
                </Can>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AppointmentModal isOpen={apptModal.isOpen} onClose={apptModal.closeModal} appointment={selected ? db.appointments.find((a) => a.id === selected.id) : undefined} defaultStart={defaultStart} />
      <AppModal
        isOpen={unaModal.isOpen}
        onClose={unaModal.closeModal}
        title="Indisponibilité d'un intervenant"
        footer={
          <>
            <Button size="sm" variant="outline" onClick={unaModal.closeModal}>
              Annuler
            </Button>
            <Button size="sm" onClick={() => run(addUnavailability, una).ok && unaModal.closeModal()}>
              Enregistrer
            </Button>
          </>
        }
      >
        <FormGrid>
          <SelectField label="Intervenant" required value={una.userId} onChange={(userId) => setUna({ ...una, userId })} options={opts.staff} />
          <TextField label="Motif" required value={una.reason} onChange={(reason) => setUna({ ...una, reason })} />
          <TextField label="Début" type="datetime-local" value={una.start} onChange={(start) => setUna({ ...una, start })} />
          <TextField label="Fin" type="datetime-local" value={una.end} onChange={(end) => setUna({ ...una, end })} />
        </FormGrid>
      </AppModal>
    </div>
  );
}

function MonthGrid({ cursor, appointments, onDay }: { cursor: Date; appointments: Appointment[]; onDay: (d: Date) => void }) {
  const { today } = useDemo();
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return (
    <div className="px-2 sm:px-4">
      <div className="grid grid-cols-7 text-center text-theme-xs font-medium text-gray-500">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
        {cells.map((d) => {
          const key = isoDay(d);
          const list = appointments.filter((a) => a.start.slice(0, 10) === key && a.status !== "annule");
          return (
            <button key={key} onClick={() => onDay(d)} className={cn("min-h-16 bg-white p-1.5 text-start align-top hover:bg-brand-25 sm:min-h-24 dark:bg-gray-900 dark:hover:bg-white/5", d.getMonth() !== cursor.getMonth() && "opacity-40")}>
              <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-theme-xs", key === today ? "bg-brand-500 text-white" : "text-gray-700 dark:text-gray-300")}>{d.getDate()}</span>
              {list.length > 0 && (
                <span className="mt-1 block rounded-md bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-700 sm:text-theme-xs dark:bg-brand-500/15 dark:text-brand-300">
                  {list.length} RDV
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
