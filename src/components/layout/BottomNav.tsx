"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FolderOpen, Layers, LayoutList, ClipboardList,
  MoreHorizontal, FlaskConical, FileBarChart2, Users, X, MapPin,
} from "lucide-react";

const PROJECT_TABS = new Set(["/campanas", "/estaciones", "/ocurrencias"]);

const mainItems = [
  { href: "/proyectos",   label: "Proyectos",   icon: FolderOpen    },
  { href: "/campanas",    label: "Campañas",    icon: Layers        },
  { href: "/estaciones",  label: "Réplicas",    icon: LayoutList    },
  { href: "/ocurrencias", label: "Ocurrencias", icon: ClipboardList },
];

const moreItemsBase = [
  { href: "/admin/especies",  label: "Especies",  icon: FlaskConical  },
  { href: "/reportes",        label: "Reportes",  icon: FileBarChart2 },
];

const moreItemsAdmin = [
  { href: "/terreno",         label: "Terreno",   icon: MapPin        },
  { href: "/admin/usuarios",  label: "Usuarios",  icon: Users         },
];

function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!navigator.onLine) {
    e.preventDefault();
    window.location.href = href;
  }
}

function BottomNavInner({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const [open, setOpen] = useState(false);

  const moreItems = isAdmin ? [...moreItemsBase, ...moreItemsAdmin] : moreItemsBase;
  const moreActive = moreItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-up panel */}
      <div
        className={cn(
          "lg:hidden fixed left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        )}
        style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-4 pb-4 pt-2 space-y-1">
          {moreItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => { handleNavClick(e, href); setOpen(false); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-teal-600" : "text-gray-400")} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="flex"
          style={{
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          {mainItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            const fullHref = projectId && PROJECT_TABS.has(href) ? `${href}?projectId=${projectId}` : href;
            return (
              <Link
                key={href}
                href={fullHref}
                onClick={(e) => { handleNavClick(e, fullHref); setOpen(false); }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors",
                  active ? "text-teal-700" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", active ? "text-teal-700" : "text-gray-400")} />
                <span className="text-[10px] font-medium leading-tight text-center truncate w-full px-0.5">
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Más button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors",
              moreActive || open ? "text-teal-700" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {open
              ? <X className="h-5 w-5 shrink-0 text-teal-700" />
              : <MoreHorizontal className={cn("h-5 w-5 shrink-0", moreActive ? "text-teal-700" : "text-gray-400")} />
            }
            <span className="text-[10px] font-medium leading-tight">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Suspense fallback={
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {mainItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-gray-500">
              <Icon className="h-5 w-5 shrink-0 text-gray-400" />
              <span className="text-[10px] font-medium leading-tight text-center truncate w-full px-0.5">{label}</span>
            </Link>
          ))}
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] text-gray-500">
            <MoreHorizontal className="h-5 w-5 shrink-0 text-gray-400" />
            <span className="text-[10px] font-medium leading-tight">Más</span>
          </div>
        </div>
      </nav>
    }>
      <BottomNavInner isAdmin={isAdmin} />
    </Suspense>
  );
}
