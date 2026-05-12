import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { NuevoUsuarioDialog } from "@/components/admin/NuevoUsuarioDialog";
import { ToggleUserButton } from "@/components/admin/ToggleUserButton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function UsuariosPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { occurrences: true } } },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">{users.length} usuario{users.length !== 1 ? "s" : ""} registrados</p>
        </div>
        <NuevoUsuarioDialog />
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-sm">No hay usuarios registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900">{u.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  <p className="text-xs text-gray-400">
                    {u._count.occurrences} ocurrencias · creado{" "}
                    {format(new Date(u.createdAt), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                <ToggleUserButton id={u.id} active={u.active} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
