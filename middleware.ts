import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

// In demo mode (no GitHub OAuth credentials, or CLARITY_USE_MOCKS=true),
// skip auth entirely so the app is usable end-to-end without a GitHub app.
const DEMO_MODE =
  process.env.CLARITY_USE_MOCKS !== "false" ||
  !process.env.GITHUB_CLIENT_ID ||
  !process.env.GITHUB_CLIENT_SECRET;

const authMiddleware = withAuth({ pages: { signIn: "/login" } });

export default function middleware(req: NextRequest) {
  // The public landing page (/) is always accessible, even in auth mode.
  if (req.nextUrl.pathname === "/") return NextResponse.next();
  if (DEMO_MODE) return NextResponse.next();
  // @ts-expect-error withAuth returns an augmented middleware
  return authMiddleware(req);
}

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico|public).*)"],
};
