import { redirect } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { Header, DesktopSidebar } from "@/widgets/layout";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header user={{ name: session.user.name ?? null, email: session.user.email! }} />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
      </div>
    </div>
  );
}
