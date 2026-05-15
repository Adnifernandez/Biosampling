import { redirect } from "next/navigation";

export default async function LegacyNuevaCampanaPage() {
  redirect("/campanas/nueva");
}
