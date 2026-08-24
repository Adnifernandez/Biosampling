"use client";

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeCampaignStatus } from "@/app/(app)/campanas/actions";
import { toast } from "sonner";

export function CloseCampaignButton({ id, status }: { id: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const isClosed = status === "COMPLETED";

  async function handleToggle() {
    setLoading(true);
    const next = isClosed ? "ACTIVE" : "COMPLETED";
    const result = await changeCampaignStatus(id, next);
    setLoading(false);
    if (result.success) {
      toast.success(isClosed ? "Campaña reactivada" : "Campaña cerrada");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      title={isClosed ? "Reabrir campaña" : "Cerrar campaña"}
      className={isClosed ? "text-teal-700 border-teal-300 hover:bg-teal-50" : "text-gray-500 hover:text-orange-600 hover:border-orange-300"}
    >
      {isClosed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
    </Button>
  );
}
