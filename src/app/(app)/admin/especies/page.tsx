import { prisma } from "@/lib/prisma";
import { EspeciesClient } from "@/components/admin/EspeciesClient";

export default async function EspeciesPage() {
  const total = await prisma.species.count();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Especies</h1>
        <p className="text-sm text-gray-500">{total} especie{total !== 1 ? "s" : ""} en el listado</p>
      </div>
      <EspeciesClient />
    </div>
  );
}
