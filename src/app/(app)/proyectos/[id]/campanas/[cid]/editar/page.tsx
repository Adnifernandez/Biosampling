import { redirect } from "next/navigation";

export default async function LegacyEditarCampanaPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { cid } = await params;
  redirect(`/campanas/${cid}/editar`);
}
