import { NextResponse, type NextRequest } from "next/server";

const DEMO_COOKIE = "clarity_demo_user_id";

function randomDemoId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `demo-${hex}`;
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") return NextResponse.next();

  if (pathname === "/overview" || pathname === "/workspace" || pathname === "/health" || pathname === "/insights" || pathname === "/sprints") {
    return NextResponse.redirect(new URL("/projects", req.url));
  }

  const existingId = req.cookies.get(DEMO_COOKIE)?.value;
  const demoId = existingId ?? randomDemoId();

  // Inject the cookie into the request headers so that the same-request
  // server components and route handlers see it via cookies().
  const requestHeaders = new Headers(req.headers);
  const existingCookieHeader = requestHeaders.get("cookie") ?? "";
  if (!existingId) {
    requestHeaders.set(
      "cookie",
      existingCookieHeader
        ? `${existingCookieHeader}; ${DEMO_COOKIE}=${demoId}`
        : `${DEMO_COOKIE}=${demoId}`,
    );
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existingId) {
    res.cookies.set(DEMO_COOKIE, demoId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)"],
};
