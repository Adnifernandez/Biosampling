import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canRecover } from "@/lib/recovery-access";
import { RecuperarClient } from "./RecuperarClient";

export default async function RecuperarPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canRecover(session.user.email)) redirect("/proyectos");
  return <RecuperarClient />;
}
