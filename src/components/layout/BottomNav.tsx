"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { FolderOpen, Layers, LayoutList, ClipboardList } from "lucide-react";

const PROJECT_TABS = new Set(["/campanas", "/estaciones", "/ocurrencias"]);

const navItems = [
  { href: "/proyectos",   label: "Proyectos",   icon: FolderOpen    },
  { href: "/campanas",    label: "Campañas",    icon: Layers        },
  { href: "/estaciones",  label: "Réplicas",    icon: LayoutList    },
  { href: "/ocurrencias", label: "Ocurrencias", icon: ClipboardList },
];

function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!navigator.onLine) {
    e.preventDefault();
    window.location.href = href;
  }
}

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-inset-bottom">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const fullHref = projectId && PROJECT_TABS.has(href) ? `${href}?projectId=${projectId}` : href;
          return (
            <Link
              key={href}
              href={fullHref}
              onClick={(e) => handleNavClick(e, fullHref)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                active ? "text-teal-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-teal-700" : "text-gray-400")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-inset-bottom">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium text-gray-500">
              <Icon className="h-5 w-5 text-gray-400" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    }>
      <BottomNavInner />
    </Suspense>
  );
}
