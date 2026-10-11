"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useDemo } from "@/context/DemoStoreContext";
import { useQueryParam } from "@/hooks/useQueryFlag";
import { useRouter } from "@/i18n/navigation";
import { createConsultation, submitConsultation, type ConsultationInput } from "@/lib/services/consultationsService";
import { useEffect, useState } from "react";
import ConsultationEditor, { emptyConsultation } from "./ConsultationEditor";

export default function NewConsultation() {
  const { db, run, user } = useDemo();
  const router = useRouter();
  const patientParam = useQueryParam("patient");
  const rdvParam = useQueryParam("rdv");
  const [v, setV] = useState<ConsultationInput>(() => emptyConsultation("", "", user && ["dg", "vet"].includes(user.roleId) ? user.id : ""));

  useEffect(() => {
    const appt = rdvParam ? db.appointments.find((a) => a.id === rdvParam) : undefined;
    const patient = db.patients.find((p) => p.id === (appt?.patientId ?? patientParam));
    if (appt || patient) {
      setV((s) => ({
        ...s,
        clientId: appt?.clientId ?? patient?.ownerId ?? "",
        patientId: patient?.id ?? "",
        reason: appt?.reason ?? s.reason,
        appointmentId: appt?.id,
        vetId: appt && db.users.find((u) => u.id === appt.practitionerId && ["dg", "vet"].includes(u.roleId)) ? appt.practitionerId : s.vetId,
        financialStatus: appt?.queueStatus === "regle" || appt?.queueStatus === "en_consultation" ? "regle_avance" : "non_regle",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientParam, rdvParam]);

  const save = (submit: boolean) => {
    const r = run(createConsultation, v);
    if (!r.ok || !r.data) return;
    if (submit) run(submitConsultation, { id: r.data });
    router.push(`/consultations/${r.data}`);
  };

  return (
    <div>
      <PageBreadcrumb
        pageTitle="Nouvelle consultation"
        trail={[{ label: "Consultations", href: "/consultations" }]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button size="sm" variant="outline" onClick={() => save(false)} disabled={!v.patientId || !v.reason.trim() || !v.vetId}>
              Enregistrer le brouillon
            </Button>
            <Button size="sm" onClick={() => save(true)} disabled={!v.patientId || !v.reason.trim() || !v.vetId || !v.diagnosis.trim()}>
              Soumettre à validation
            </Button>
          </>
        }
      />
      <ConsultationEditor value={v} onChange={setV} />
    </div>
  );
}
