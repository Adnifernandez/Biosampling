import { redirect } from "next/navigation";

export default async function LegacyCampanaDetailPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { cid } = await params;
  redirect(`/campanas/${cid}`);
}
