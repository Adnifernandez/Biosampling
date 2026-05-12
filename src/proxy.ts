export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
