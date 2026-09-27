const PUBLIC_PATHS = ["/login", "/register"];

export function resolveRedirect(pathname: string, isAuthenticated: boolean): string | null {
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!isAuthenticated && !isPublic) return "/login";
  if (isAuthenticated && isPublic) return "/";
  return null;
}
