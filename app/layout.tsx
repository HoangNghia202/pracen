import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { APP_NAME } from "@/shared/config/app-config";
import { Toaster } from "@/shared/ui/sonner";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";

export const metadata = {
  title: APP_NAME,
  description: "Personal vocabulary learning app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
        <ConfirmDialog />
      </body>
    </html>
  );
}
