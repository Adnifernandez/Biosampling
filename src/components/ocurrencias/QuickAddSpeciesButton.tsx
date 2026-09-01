"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { quickCreateSpecies } from "@/app/(app)/admin/especies/actions";

type QuickSpecies = {
  id: string;
  genus: string;
  species: string;
  commonName: string | null;
  family: string;
  conservationStatus: string | null;
};

const schema = z.object({
  scientificName: z.string().min(3, "Escribe género y especie, ej: Puma concolor"),
  commonName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function QuickAddSpeciesButton({
  surveyType,
  onCreated,
}: {
  surveyType: "FLORA" | "FAUNA";
  onCreated: (species: QuickSpecies) => void;
}) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const result = await quickCreateSpecies({
      scientificName: data.scientificName,
      commonName: data.commonName,
      type: surveyType,
    });
    if (!result.success || !result.species) {
      toast.error(result.error ?? "No se pudo agregar la especie");
      return;
    }
    toast.success("Especie agregada");
    onCreated(result.species);
    reset();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-teal-700 hover:text-teal-800 underline underline-offset-2"
      >
        ¿No está la especie? ¡Agrégala!
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar especie</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="scientificName">Nombre científico <span className="text-red-500">*</span></Label>
              <Input id="scientificName" {...register("scientificName")} placeholder="Ej: Puma concolor" />
              {errors.scientificName && <p className="text-xs text-red-500">{errors.scientificName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commonName">Nombre común</Label>
              <Input id="commonName" {...register("commonName")} placeholder="Ej: Puma" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-teal-700 hover:bg-teal-800" disabled={isSubmitting}>
                {isSubmitting ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
