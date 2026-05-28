"use client";

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeProjectStatus } from "@/app/(app)/proyectos/actions";
import { toast } from "sonner";

export function CloseProjectButton({ id, status }: { id: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const isClosed = status === "COMPLETED";

  async function handleToggle() {
    setLoading(true);
    const next = isClosed ? "ACTIVE" : "COMPLETED";
    const result = await changeProjectStatus(id, next);
    setLoading(false);
    if (result.success) {
      toast.success(isClosed ? "Proyecto reactivado" : "Proyecto cerrado");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      title={isClosed ? "Reabrir proyecto" : "Cerrar proyecto"}
      className={isClosed ? "text-green-700 border-green-300 hover:bg-green-50" : "text-gray-500 hover:text-orange-600 hover:border-orange-300"}
    >
      {isClosed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
    </Button>
  );
}
