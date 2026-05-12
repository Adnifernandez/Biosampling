"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { deleteCampaign } from "@/app/(app)/proyectos/[id]/campanas/actions";
import { toast } from "sonner";

export function DeleteCampaignButton({ projectId, campaignId }: { projectId: string; campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await deleteCampaign(projectId, campaignId);
    toast.success("Campaña eliminada");
    router.push(`/proyectos/${projectId}`);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar campaña?</DialogTitle>
            <DialogDescription>
              Se eliminarán también todas las estaciones y ocurrencias. Esta acción no se puede deshacer.
            </DialogDescription>
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
