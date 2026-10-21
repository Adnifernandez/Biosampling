import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SincronizacionClient } from "./SincronizacionClient";

export default async function SincronizacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <SincronizacionClient />;
}
