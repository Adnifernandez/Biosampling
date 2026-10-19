import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SincronizacionClient } from "./SincronizacionClient";

export default async function SincronizacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  // Robust sync is admin-only while it's being tested
  if (session.user.role !== "ADMIN") redirect("/proyectos");
  return <SincronizacionClient />;
}
