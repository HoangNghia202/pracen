export function HomePage({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
      <p className="text-muted-foreground text-sm">
        Signed in as {email}. The Dashboard, Library, and Quiz modules are
        built out in later plans.
      </p>
    </div>
  );
}
