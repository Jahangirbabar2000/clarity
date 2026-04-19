import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

const DEMO_MODE =
  process.env.CLARITY_USE_MOCKS === "true" ||
  !process.env.GITHUB_CLIENT_ID ||
  !process.env.GITHUB_CLIENT_SECRET;

const authMiddleware = withAuth({ pages: { signIn: "/login" } });

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") return NextResponse.next();
  if (DEMO_MODE) return NextResponse.next();

  // Redirect root dashboard hits to projects list
  if (pathname === "/overview" || pathname === "/workspace" || pathname === "/health" || pathname === "/insights" || pathname === "/sprints") {
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  // @ts-expect-error withAuth returns an augmented middleware
  return authMiddleware(req);
}

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico|public).*)"],
};
