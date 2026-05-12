"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderOpen, FileBarChart2, Users } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/proyectos", label: "Proyectos", icon: FolderOpen },
  { href: "/reportes", label: "Reportes", icon: FileBarChart2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-inset-bottom">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                active ? "text-green-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-green-700" : "text-gray-400")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
