import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BioSampling",
  description: "Levantamiento de flora y fauna en terreno",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BioSampling" },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.className} h-full`}>
      <body className="h-full bg-gray-50 antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
