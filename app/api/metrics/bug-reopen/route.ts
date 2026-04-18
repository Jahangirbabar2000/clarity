import { NextResponse } from "next/server";
import { getBugReopenRate } from "@/lib/integrations/jira";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectKey = url.searchParams.get("projectKey") ?? "CLAR";
  const sinceDays = Number(url.searchParams.get("sinceDays") ?? 56);
  try {
    return NextResponse.json(await getBugReopenRate(projectKey, sinceDays));
  } catch {
    return NextResponse.json({ hasData: false, current: null, previous: null, trend: [] });
  }
}
