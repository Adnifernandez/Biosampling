import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EspeciesClient } from "@/components/admin/EspeciesClient";
import { listPendingSpecies } from "./actions";

export default async function EspeciesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ?completar=<id> comes from the report's incomplete-species warning
  const { completar } = await searchParams;
  const completarId = typeof completar === "string" ? completar : null;

  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const [total, pending, toComplete] = await Promise.all([
    prisma.species.count(),
    listPendingSpecies(),
    completarId
      ? prisma.species.findUnique({
          where: { id: completarId },
          include: {
            _count: { select: { occurrences: true } },
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
          },
        })
      : null,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Especies</h1>
        <p className="text-sm text-gray-500">{total} especie{total !== 1 ? "s" : ""} en el listado</p>
      </div>
      <EspeciesClient initialPending={pending} initialEdit={toComplete} isAdmin={isAdmin} />
    </div>
  );
}
