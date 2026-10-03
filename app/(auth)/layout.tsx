export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-brand-amber-light opacity-70 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-brand-teal-light opacity-60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 right-1/4 size-64 rounded-full bg-brand-olive-light opacity-50 blur-3xl"
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
