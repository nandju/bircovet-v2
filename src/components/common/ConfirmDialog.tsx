"use client";

import AppModal from "@/components/common/AppModal";
import { TextAreaField, TextField } from "@/components/form/Field";
import Button from "@/components/ui/button/Button";
import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => boolean | void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  reasonLabel?: string; // si défini, un motif est obligatoire
  typedConfirmation?: string; // si défini, l'utilisateur doit saisir ce texte
  children?: React.ReactNode;
}

/** Confirmation avant action sensible (motif et/ou saisie de confirmation optionnels). */
export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirmer", tone = "primary", reasonLabel, typedConfirmation, children }: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setTyped("");
    }
  }, [isOpen]);
  const disabled = (!!reasonLabel && !reason.trim()) || (!!typedConfirmation && typed.trim().toUpperCase() !== typedConfirmation.trim().toUpperCase());

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            disabled={disabled}
            onClick={() => {
              if (onConfirm(reason) !== false) onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">{message}</div>
        {children}
        {reasonLabel && <TextAreaField label={reasonLabel} required value={reason} onChange={setReason} rows={2} />}
        {typedConfirmation && <TextField label={`Saisissez « ${typedConfirmation} » pour confirmer`} required value={typed} onChange={setTyped} />}
      </div>
    </AppModal>
  );
}
