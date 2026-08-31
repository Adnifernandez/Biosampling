import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TerrenoClient } from "./TerrenoClient";

export default async function TerrenoPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return <TerrenoClient />;
}
