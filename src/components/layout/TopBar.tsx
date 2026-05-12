"use client";

import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { LogOut, Leaf } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TopBar() {
  const { data: session } = useSession();
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
    </header>
  );
}
