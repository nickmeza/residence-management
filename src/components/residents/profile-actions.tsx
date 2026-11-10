"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ResidentInput } from "@/server/residents/schemas";

import { InviteButton } from "./invite-button";
import { ResidentSheet, type ResidentSheetTarget } from "./resident-sheet";

// Botones del perfil: editar datos e invitar (si todavía no tiene cuenta).
export function ProfileActions({
  residentId,
  initial,
  hasAccount,
  hasPendingInvitation,
}: {
  residentId: string;
  initial: ResidentInput;
  hasAccount: boolean;
  hasPendingInvitation: boolean;
}) {
  const [sheet, setSheet] = useState<ResidentSheetTarget | null>(null);
  return (
    <div className="flex flex-wrap gap-2.5">
      {hasAccount ? null : (
        <InviteButton residentId={residentId} label={hasPendingInvitation ? "Invitar de nuevo" : "Invitar"} />
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2"
        onClick={() => setSheet({ mode: "edit", residentId, initial, hasAccount })}
      >
        <Pencil className="size-4" aria-hidden="true" />
        Editar datos
      </Button>
      <ResidentSheet target={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
