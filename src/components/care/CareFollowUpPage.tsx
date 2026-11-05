"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { careDue, CARE_REASON } from "@/lib/care";
import { HERD } from "@/lib/farmProfile";
import { cn } from "@/utils";
import { useState } from "react";
import CareCaseDetail from "./CareCaseDetail";
import CareCaseModal, { type CarePrefill } from "./CareCaseModal";
import CareList from "./CareList";

export default function CareFollowUpPage() {
  const { db, today, can } = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<CarePrefill | null>(null);
  const [farmPick, setFarmPick] = useState("");
  const [tab, setTab] = useState<"due" | "open" | "closed">("due");
  const [sp, setSp] = useState("");
  const [reason, setReason] = useState("");
  const all = (db.careCases ?? []).filter((c) => (!sp || c.species === sp) && (!reason || c.reason === reason));
  const due = all.filter((c) => careDue(c, today)).sort((a, b) => (a.nextCheck ?? "").localeCompare(b.nextCheck ?? ""));
  const openCases = all.filter((c) => c.status === "en_cours");
  const closed = all.filter((c) => c.status !== "en_cours").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
  const list = tab === "due" ? due : tab === "open" ? openCases : closed;
  const sel = "h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white";
  return (
    <div className="space-y-4 md:space-y-6">
      <PageBreadcrumb pageTitle="Suivi des prises en charge" subtitle="Animaux et cheptels traités : prenez des nouvelles au bon moment" trail={[{ label: "Exploitations", href: "/exploitations" }]} />
      <div className="flex flex-wrap items-end gap-2">
        {can("exploitations", "update") && (
          <div className="flex gap-2">
            <select className={sel} value={farmPick} onChange={(e) => setFarmPick(e.target.value)} aria-label="Exploitation"><option value="">Choisir l&apos;exploitation…</option>{db.farms.filter((f) => f.status === "actif").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
            <Button size="sm" disabled={!farmPick} onClick={() => setPrefill({ farmId: farmPick })}>Nouvelle consultation / prise en charge</Button>
          </div>
        )}
        <span className="ms-auto flex gap-2">
          <select className={sel} value={sp} onChange={(e) => setSp(e.target.value)} aria-label="Espèce"><option value="">Toutes espèces</option>{HERD.map((s) => <option key={s}>{s}</option>)}</select>
          <select className={sel} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif"><option value="">Tous motifs</option>{Object.entries(CARE_REASON).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
        </span>
      </div>
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5" role="tablist">
        {([["due", `Nouvelles à prendre (${due.length})`], ["open", `Sous prise en charge (${openCases.length})`], ["closed", `Clôturées (${closed.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", tab === k ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500")}>{l}</button>
        ))}
      </div>
      <CareList cases={list} onOpen={setOpen} showFarm />
      <CareCaseDetail id={open} onClose={() => setOpen(null)} onExtend={(p) => { setOpen(null); setPrefill(p); }} />
      <CareCaseModal prefill={prefill} onClose={() => setPrefill(null)} onSaved={(id) => setOpen(id)} />
    </div>
  );
}
