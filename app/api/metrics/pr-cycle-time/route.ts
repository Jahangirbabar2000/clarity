import { NextResponse } from "next/server";
import { getPRCycleTime } from "@/lib/integrations/github";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgName = url.searchParams.get("orgName");
  const repo = url.searchParams.get("repo");
  try {
    return NextResponse.json(await getPRCycleTime(orgName, repo));
  } catch {
    return NextResponse.json({ hasData: false, current: null, previous: null, trend: [] });
  }
}
