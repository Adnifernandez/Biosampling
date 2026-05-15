import { redirect } from "next/navigation";

export default async function LegacyEditarEstacionPage({
  params,
}: {
  params: Promise<{ id: string; cid: string; sid: string }>;
}) {
  const { sid } = await params;
  redirect(`/estaciones/${sid}/editar`);
}
