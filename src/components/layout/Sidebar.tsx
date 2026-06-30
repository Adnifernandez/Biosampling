"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  LogOut,
  Leaf,
  Users,
  FileBarChart2,
  Layers,
  LayoutList,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PROJECT_TABS = new Set(["/campanas", "/estaciones", "/ocurrencias"]);

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/proyectos", label: "Proyectos", icon: FolderOpen },
  { href: "/campanas", label: "Campañas", icon: Layers },
  { href: "/estaciones", label: "Estaciones/Réplicas", icon: LayoutList },
  { href: "/ocurrencias", label: "Ocurrencias", icon: ClipboardList },
  { href: "/reportes", label: "Reportes", icon: FileBarChart2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
];

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-teal-900 text-white h-full">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-teal-700">
        <Leaf className="h-6 w-6 text-teal-300" />
        <span className="font-bold text-lg">BioSampling</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const fullHref = projectId && PROJECT_TABS.has(href) ? `${href}?projectId=${projectId}` : href;
          return (
            <Link
              key={href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-teal-700 text-white"
                  : "text-teal-200 hover:bg-teal-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-teal-700">
        <Button
          variant="ghost"
          className="w-full justify-start text-teal-200 hover:bg-teal-800 hover:text-white gap-3"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-teal-900 text-white h-full">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-teal-700">
          <Leaf className="h-6 w-6 text-teal-300" />
          <span className="font-bold text-lg">BioSampling</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-teal-200">
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
    }>
      <SidebarInner />
    </Suspense>
  );
}
