import { NextResponse } from "next/server";
import { mockBuildHealth } from "@/lib/integrations/mock-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("demo") === "true") {
    return NextResponse.json(mockBuildHealth);
  }
  return NextResponse.json({ hasData: false, current: null, previous: null, trend: [] });
}
