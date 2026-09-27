import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { APP_NAME } from "@/shared/config/app-config";

export const metadata = {
  title: APP_NAME,
  description: "Personal vocabulary learning app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
