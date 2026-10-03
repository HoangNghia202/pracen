import { redirect } from "next/navigation";
import { auth } from "@/_app/api-routes/auth";
import { Header, DesktopSidebar } from "@/widgets/layout";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Header
        user={{
          name: session.user.name ?? null,
          email: session.user.email!,
          image: session.user.image ?? null,
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        <DesktopSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
