"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { deleteGrillaOccurrences } from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";
import { toast } from "sonner";

export function DeleteGrillaButton({
  projectId,
  campaignId,
  stationId,
  transectoId,
}: {
  projectId: string;
  campaignId: string;
  stationId: string;
  transectoId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await deleteGrillaOccurrences(projectId, campaignId, stationId);
    toast.success("Grilla eliminada");
    const back = transectoId
      ? `/ocurrencias?projectId=${projectId}&campaignId=${campaignId}&transectoId=${transectoId}&stationId=${stationId}`
      : `/ocurrencias?projectId=${projectId}&campaignId=${campaignId}&stationId=${stationId}`;
    router.push(back);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar grilla?</DialogTitle>
            <DialogDescription>Se eliminarán todos los registros de esta grilla. Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
