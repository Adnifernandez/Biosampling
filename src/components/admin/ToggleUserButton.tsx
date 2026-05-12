"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleUserActive } from "@/app/(app)/admin/usuarios/actions";
import { toast } from "sonner";

export function ToggleUserButton({ id, active }: { id: string; active: boolean }) {
  const [loading, setLoading] = useState(false);
  const [currentActive, setCurrentActive] = useState(active);

  async function handleToggle() {
    setLoading(true);
    await toggleUserActive(id, currentActive);
    setCurrentActive(!currentActive);
    toast.success(currentActive ? "Usuario desactivado" : "Usuario activado");
    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={currentActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"}
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? "..." : currentActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
