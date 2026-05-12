"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { deleteOccurrence } from "@/app/(app)/proyectos/[id]/campanas/[cid]/estaciones/[sid]/ocurrencias/actions";
import { toast } from "sonner";

export function DeleteOccurrenceButton({
  projectId,
  campaignId,
  stationId,
  occurrenceId,
}: {
  projectId: string;
  campaignId: string;
  stationId: string;
  occurrenceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await deleteOccurrence(projectId, campaignId, stationId, occurrenceId);
    toast.success("Ocurrencia eliminada");
    router.push(`/proyectos/${projectId}/campanas/${campaignId}/estaciones/${stationId}`);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar ocurrencia?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
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
