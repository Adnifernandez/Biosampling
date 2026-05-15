import { redirect } from "next/navigation";

export default async function LegacyEditarOcurrenciaPage({
  params,
}: {
  params: Promise<{ id: string; cid: string; sid: string; oid: string }>;
}) {
  const { sid, oid } = await params;
  redirect(`/estaciones/${sid}/ocurrencias/${oid}/editar`);
}
