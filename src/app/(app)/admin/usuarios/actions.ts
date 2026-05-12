"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";

const userSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export async function createUser(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "Ya existe un usuario con ese email" };

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, password: hashed },
  });

  revalidatePath("/admin/usuarios");
  return { success: true };
}

export async function toggleUserActive(id: string, active: boolean) {
  const session = await auth();
  if (!session) throw new Error("No autorizado");

  await prisma.user.update({ where: { id }, data: { active: !active } });
  revalidatePath("/admin/usuarios");
  return { success: true };
}
