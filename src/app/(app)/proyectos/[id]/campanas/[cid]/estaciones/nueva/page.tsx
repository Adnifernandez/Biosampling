import { redirect } from "next/navigation";

export default async function LegacyNuevaEstacionPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  redirect(`/estaciones/nueva?projectId=${id}&campaignId=${cid}`);
}
