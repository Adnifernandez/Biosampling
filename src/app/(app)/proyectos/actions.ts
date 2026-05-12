"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  region: z.string().min(1, "Selecciona una región"),
  commune: z.string().min(1, "Selecciona una comuna"),
  responsible: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
});

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    region: formData.get("region"),
    commune: formData.get("commune"),
    responsible: formData.get("responsible"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const project = await prisma.project.create({ data: parsed.data });
  revalidatePath("/proyectos");
  return { success: true, id: project.id };
}

export async function updateProject(id: string, formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    region: formData.get("region"),
    commune: formData.get("commune"),
    responsible: formData.get("responsible"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.project.update({ where: { id }, data: parsed.data });
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/proyectos");
  return { success: true };
}

export async function deleteProject(id: string) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.project.delete({ where: { id } });
  revalidatePath("/proyectos");
  return { success: true };
}

export async function changeProjectStatus(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.project.update({ where: { id }, data: { status } });
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/proyectos");
  return { success: true };
}
