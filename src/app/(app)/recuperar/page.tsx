import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RecuperarClient } from "./RecuperarClient";

export default async function RecuperarPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/proyectos");
  return <RecuperarClient />;
}
