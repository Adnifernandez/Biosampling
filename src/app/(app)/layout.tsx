import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { ClientProviders } from "@/components/layout/ClientProviders";
import { canRecover } from "@/lib/recovery-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const showRecover = canRecover(session.user.email);

  return (
    <ClientProviders session={session}>
      <div className="flex h-full">
        <Sidebar isAdmin={isAdmin} showRecover={showRecover} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
            {children}
          </main>
        </div>
      </div>
      <BottomNav isAdmin={isAdmin} showRecover={showRecover} />
    </ClientProviders>
  );
}
