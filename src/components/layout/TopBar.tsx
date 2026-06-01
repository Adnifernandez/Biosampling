"use client";

import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { LogOut, Leaf, WifiOff, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useOnlineSync } from "@/hooks/useOnlineSync";

export function TopBar() {
  const { data: session } = useSession();
  const { isOnline, isSyncing, pendingCount, sync } = useOnlineSync();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "U";

  return (
    <header className="lg:hidden bg-green-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <Leaf className="h-5 w-5 text-green-300" />
        <span className="font-semibold">BioSampling</span>
      </div>

      <div className="flex items-center gap-2">
        {!isOnline && (
          <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-400/40 rounded-full px-2 py-0.5">
            <WifiOff className="h-3.5 w-3.5 text-yellow-300" />
            <span className="text-xs text-yellow-200">Sin conexión</span>
          </div>
        )}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={sync}
            disabled={isSyncing}
            className="flex items-center gap-1 bg-orange-500/20 border border-orange-400/40 rounded-full px-2 py-0.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-orange-300 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="text-xs text-orange-200">
              {isSyncing ? "Sincronizando..." : `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}`}
            </span>
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 rounded hover:bg-green-700 transition-colors">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-green-600 text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs text-gray-500 pointer-events-none">
              {session?.user?.name}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
