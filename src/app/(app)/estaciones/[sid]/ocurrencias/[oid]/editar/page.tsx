import { redirect } from "next/navigation";

export default async function LegacyEditarOcurrenciaPage({
  params,
}: {
  params: Promise<{ sid: string; oid: string }>;
}) {
  const { oid } = await params;
  redirect(`/ocurrencias/${oid}/editar`);
}
