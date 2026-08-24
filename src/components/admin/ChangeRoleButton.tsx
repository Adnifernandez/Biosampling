"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { changeUserRole } from "@/app/(app)/admin/usuarios/actions";
import { toast } from "sonner";

export function ChangeRoleButton({ id, role, isSelf }: { id: string; role: string; isSelf: boolean }) {
  const [loading, setLoading] = useState(false);
  const [currentRole, setCurrentRole] = useState(role);

  async function handleChange() {
    setLoading(true);
    const result = await changeUserRole(id, currentRole);
    if (result?.error) {
      toast.error(result.error);
    } else {
      const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
      setCurrentRole(newRole);
      toast.success(`Rol cambiado a ${newRole === "ADMIN" ? "Admin" : "Usuario"}`);
    }
    setLoading(false);
  }

  if (isSelf) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-purple-600 hover:text-purple-800"
      onClick={handleChange}
      disabled={loading}
    >
      {loading ? "..." : currentRole === "ADMIN" ? "Quitar admin" : "Hacer admin"}
    </Button>
  );
}
