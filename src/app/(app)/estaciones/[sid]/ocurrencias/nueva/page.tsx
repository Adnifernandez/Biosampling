import { redirect } from "next/navigation";

export default async function LegacyNuevaOcurrenciaPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = await params;
  redirect(`/ocurrencias/nueva?stationId=${sid}`);
}
