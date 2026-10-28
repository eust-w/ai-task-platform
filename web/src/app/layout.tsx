import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI任务平台 · AI Task Platform",
  description: "Self-hosted AI image and conversation task workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-white text-zinc-900 antialiased">
        <Toaster position="top-right" richColors />
        {children}
      </body>
    </html>
  );
}
